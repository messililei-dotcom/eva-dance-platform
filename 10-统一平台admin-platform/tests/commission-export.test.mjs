import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const module={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync(new URL('../src/lib/commission-export.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module,module.exports);
const {commissionExportRows}=module.exports;
test('导出完整清单，金额为数值，手机号和公式样式备注保留文本',()=>{
 const rows=Array.from({length:31},(_,i)=>({id:i+1,source:i%2?'online':'offline',date:'2026-09-01',advisor:'海艳',memberName:'测试学员',memberPhone:'0013800000000',courseName:'课程',courseSubType:'一期',paidAmount:399,rate:60,commission:239.4,remark:'=1+1'}));
 const sheet=commissionExportRows(rows);
 assert.equal(sheet.length,32);assert.equal(sheet[0].length,12);
 assert.equal(sheet[1][5].value,'0013800000000');assert.equal(sheet[1][5].type,String);
 assert.equal(sheet[1][8].type,Number);assert.equal(sheet[1][10].value,239.4);
 assert.equal(sheet[1][11].type,String);assert.equal(sheet[1][11].value,'=1+1');
 assert.equal(sheet[2][0].value,'线上授权');
 const filtered=commissionExportRows(rows.filter(r=>r.source==='online'));
 assert.equal(filtered.length,16);assert.equal(filtered.slice(1).reduce((sum,row)=>sum+row[10].value,0).toFixed(2),'3591.00');
});

test('真实Excel文件生成后可读回条数、金额及文本',async()=>{
 const {default:writeXlsxFile}=await import('write-excel-file/node');
 const {default:readXlsxFile}=await import('read-excel-file/node');
 const rows=Array.from({length:21},(_,i)=>({id:i+1,source:'online',date:'2026-09-01',advisor:'海艳',memberPhone:'0013800000000',paidAmount:399,rate:60,commission:239.4,remark:'=1+1'}));
 const buffer=await writeXlsxFile(commissionExportRows(rows)).toBuffer();
 const [{data:sheet}]=await readXlsxFile(buffer);
 assert.equal(sheet.length,22);assert.equal(sheet[1][5],'0013800000000');assert.equal(sheet[1][10],239.4);assert.equal(sheet[1][11],'=1+1');
});
