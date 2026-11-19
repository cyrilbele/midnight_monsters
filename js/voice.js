'use strict';

// A speaker sends an audio-only stream to each room member who asks to listen.
// Answering a call never attaches the listener's own microphone.
class RoomVoice {
  constructor(room) {
    this.room = room;
    this.members = new Map();
    this.incoming = new Map();
    this.outgoing = new Map();
    this.stream = null;
    this.listening = false;
    this.pending = false;
    this.error = '';
  }

  changed() {
    if (Online.session?.voice === this) Online.updateVoice();
  }

  setMembers(rows) {
    const previous = this.members;
    this.members = new Map(rows);
    for (const [id, entry] of this.incoming) if (!this.members.get(id)) this.removeIncoming(entry);
    for (const id of this.outgoing.keys()) if (!this.members.has(id)) this.stopSendingTo(id);
    if (this.listening) {
      for (const [id, active] of this.members) {
        if (active && !previous.get(id) && id !== this.room.peer.id) this.room.requestVoice(id);
      }
    }
  }

  async toggleMic() {
    if (this.closed || this.pending) return;
    this.error = '';
    if (this.stream) {
      this.stopMic();
      this.room.micChanged(false);
      this.changed();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) { this.error = 'voice.noMic'; this.changed(); return; }
    if (!this.listening || this.playbackBlocked) this.listen(true);
    this.pending = true; this.changed();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
      });
      if (this.closed) { for (const track of stream.getTracks()) track.stop(); return; }
      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState === 'ended') {
        for (const t of stream.getTracks()) t.stop();
        this.error = 'voice.noMic';
        return;
      }
      this.stream = stream;
      track.enabled = !document.hidden;
      track.addEventListener('ended', () => {
        if (this.stream !== stream) return;
        this.stopMic(); this.room.micChanged(false); this.error = 'voice.noMic'; this.changed();
      }, { once: true });
      this.room.micChanged(true);
    } catch (err) {
      this.error = err.name === 'NotAllowedError' || err.name === 'SecurityError' ? 'voice.denied' : 'voice.noMic';
    } finally { this.pending = false; this.changed(); }
  }

  stopMic() {
    const stream = this.stream;
    this.stream = null;
    for (const track of stream?.getTracks() || []) track.stop();
    for (const call of this.outgoing.values()) call.close();
    this.outgoing.clear();
  }

  get playbackBlocked() { return [...this.incoming.values()].some(entry => entry.blocked); }

  listen(enabled) {
    if (this.closed) return;
    this.listening = enabled; this.error = '';
    if (enabled) {
      for (const [id, active] of this.members) {
        if (!active || id === this.room.peer.id) continue;
        const entry = this.incoming.get(id);
        if (entry) this.play(entry);
        else this.room.requestVoice(id);
      }
    } else {
      for (const [id, active] of this.members) {
        if (active && id !== this.room.peer.id) this.room.requestVoice(id, false);
      }
      for (const entry of this.incoming.values()) this.removeIncoming(entry);
    }
    this.changed();
  }

  stopSendingTo(id) {
    const call = this.outgoing.get(id);
    this.outgoing.delete(id);
    call?.close();
  }

  sendTo(id, enabled) {
    if (this.closed || !this.members.has(id) || id === this.room.peer.id) return;
    // A fresh listener request also replaces a stale call after mute/rejoin.
    this.stopSendingTo(id);
    if (!enabled || !this.stream) return;
    if (this.room.peer.disconnected) { this.error = 'voice.network'; this.changed(); return; }
    const call = this.room.peer.call(id, this.stream, { metadata: { voiceRoom: this.room.roomId } });
    if (!call) { this.error = 'voice.network'; this.changed(); return; }
    this.outgoing.set(id, call);
    call.on('close', () => { if (this.outgoing.get(id) === call) this.outgoing.delete(id); });
    call.on('error', () => {
      if (this.outgoing.get(id) !== call) return;
      this.stopSendingTo(id); this.error = 'voice.network'; this.changed();
    });
  }

  accept(call) {
    if (this.closed || !this.listening || !this.members.get(call.peer) || call.metadata?.voiceRoom !== this.room.roomId) {
      call.close(); return;
    }
    const previous = this.incoming.get(call.peer);
    if (previous) this.removeIncoming(previous);
    const entry = { call, audio: null, blocked: false };
    this.incoming.set(call.peer, entry);
    call.on('stream', stream => {
      if (this.incoming.get(call.peer) !== entry || !stream.getAudioTracks().length) return;
      if (!entry.audio) {
        entry.audio = document.createElement('audio');
        entry.audio.hidden = true; entry.audio.setAttribute('playsinline', '');
        document.body.append(entry.audio);
      }
      entry.audio.srcObject = new MediaStream(stream.getAudioTracks());
      this.play(entry);
    });
    call.on('close', () => this.removeIncoming(entry));
    call.on('error', () => { this.removeIncoming(entry); this.error = 'voice.network'; this.changed(); });
    call.answer();
  }

  play(entry) {
    if (!entry.audio || document.hidden || !this.listening) return;
    entry.audio.play().then(() => {
      if (entry.blocked) { entry.blocked = false; this.changed(); }
    }).catch(err => {
      if (this.incoming.get(entry.call.peer) !== entry || err.name === 'AbortError') return;
      entry.blocked = true; this.changed();
    });
  }

  removeIncoming(entry) {
    if (this.incoming.get(entry.call.peer) !== entry) return;
    this.incoming.delete(entry.call.peer);
    if (entry.audio) { entry.audio.pause(); entry.audio.srcObject = null; entry.audio.remove(); }
    entry.call.close();
    if (entry.blocked) this.changed();
  }

  visibility() {
    for (const track of this.stream?.getAudioTracks() || []) track.enabled = !document.hidden;
    for (const entry of this.incoming.values()) {
      if (document.hidden) entry.audio?.pause();
      else this.play(entry);
    }
  }

  close() {
    this.closed = true; this.listening = false;
    this.stopMic();
    for (const entry of this.incoming.values()) this.removeIncoming(entry);
    this.members.clear(); this.changed();
  }
}
