import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), m={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync(new URL('../src/lib/date-locale.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(require,m,m.exports);
const {numericMonths,numericDateLocale,formatDateInputValue}=m.exports,dayjs=require('dayjs'),generate=require('rc-picker/lib/generate/dayjs').default;
test('日期、月份、年份、范围及日历使用数字月份和中文语言',()=>{
 assert.equal(dayjs.locale(),'zh-cn');
 assert.deepEqual(generate.locale.getShortMonths('zh_CN'),numericMonths);
 for(let month=1;month<=12;month++){
  const d=dayjs(`2026-${String(month).padStart(2,'0')}-13`);
  assert.equal(d.format('MMMM'),`${month}月`);
  assert.equal(generate.locale.format('zh_CN',d,numericDateLocale.DatePicker.lang.monthFormat),`${month}月`);
 }
 assert.deepEqual(numericDateLocale.Calendar.lang.shortMonths,numericMonths);
 assert.equal(generate.locale.format('zh_CN',dayjs('2026-10-13'),numericDateLocale.DatePicker.lang.fieldMonthFormat),'2026-10');
 assert.match(generate.locale.format('zh_CN',dayjs('2026-10-13'),numericDateLocale.DatePicker.lang.fieldWeekFormat),/^2026年第\d+周$/);
 assert.match(generate.locale.format('zh_CN',dayjs('2026-10-13'),numericDateLocale.DatePicker.lang.fieldQuarterFormat),/^2026年第4季度$/);
 assert.deepEqual(generate.locale.getShortWeekDays('zh_CN'),['日','一','二','三','四','五','六']);
});
test('替换原生日期控件保留表单字符串、当地时间和清空语义',()=>{
 assert.equal(formatDateInputValue(dayjs('2026-10-13')),'2026-10-13');
 assert.equal(formatDateInputValue(dayjs('2026-10-13T08:05'),true),'2026-10-13T08:05');
 assert.equal(formatDateInputValue(dayjs('2024-02-29')),'2024-02-29');
 assert.equal(formatDateInputValue(null),'');
 assert.equal(formatDateInputValue(dayjs('invalid')),'');
});
