'use strict';

const I18n = {
  catalogs: {},
  language: 'en',
  numbers: [],

  browserLanguage() {
    const supported = Object.keys(this.catalogs).map(code => new Intl.Locale(code));
    for (const tag of [...(navigator.languages || []), navigator.language]) {
      let locale;
      try { locale = new Intl.Locale(tag); } catch { continue; }
      if (Object.hasOwn(this.catalogs, locale.baseName)) return locale.baseName;
      const script = locale.maximize().script;
      const match = supported.find(candidate => candidate.language === locale.language && candidate.maximize().script === script);
      if (match) return match.baseName;
    }
    return 'en';
  },

  setLanguage(code) {
    this.language = typeof code === 'string' && Object.hasOwn(this.catalogs, code) ? code : this.browserLanguage();
    this.numbers = [];
    document.documentElement.lang = this.language;
  },

  get copy() { return this.catalogs[this.language]; },
  get fonts() {
    if (this.language === 'ja') return '"Hiragino Sans", "Yu Gothic", Meiryo, "Noto Sans CJK JP", sans-serif';
    if (this.language === 'zh-CN') return '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
    return '"Arial Black", Arial, sans-serif';
  },

  seconds(value, digits = 0) {
    this.numbers[digits] ??= new Intl.NumberFormat(this.language, {
      minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false,
    });
    return tr('unit.seconds', { n: this.numbers[digits].format(value) });
  },
};

function tr(key, values) {
  const text = I18n.copy.strings[key] ?? I18n.catalogs.en.strings[key];
  return values ? text.replace(/\{(\w+)\}/g, (_, name) => values[name]) : text;
}
