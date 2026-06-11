"""
荔枝微课订单导入脚本
处理两个Excel文件并导入到 admin.db 的 orders 表
处理原则详见李校长要求
"""

import openpyxl
import sqlite3
import re
import sys
from collections import defaultdict

# ===== 配置 =====
DB_PATH = "../admin.db"
FILES = [
    {
        'path': "/Users/lilei/.openclaw/media/inbound/线上课_荔枝订单汇总_20200201-20240101---c8101e14-6a3a-4723-8866-4d91bca17ddc.xlsx",
        'col_order': 0,   # 订单号
        'col_product': 1, # 商品名
        'col_name': 2,    # 用户名称
        'col_status': 3,  # 订单状态
        'col_amount': 4,  # 订单金额
        'col_time': 5,    # 支付时间
        'col_phone': 6,   # 手机号
    },
    {
        'path': "/Users/lilei/.openclaw/media/inbound/线上课_荔枝订单汇总_20240801-20260522---481b8be3-565a-487c-a7b5-796d256c7eae.xlsx",
        'col_order': 0,   # 订单号
        'col_product': 1, # 商品名称
        'col_name': 2,    # 用户
        'col_phone': 3,   # 手机号
        'col_status': 4,  # 订单状态
        'col_amount': 5,  # 订单金额
        'col_time': 6,    # 支付时间
    }
]


def parse_time(raw):
    """解析多样的支付时间格式"""
    if not raw or raw == 'None':
        return None
    raw = str(raw).strip()
    # 尝试不同格式
    for fmt in [
        r'(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}:\d{2})',
        r'(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})',
        r'(\d{4}-\d{1,2}-\d{1,2})',
        r'(\d{4}/\d{1,2}/\d{1,2}\s+\d{1,2}:\d{2}:\d{2})',
        r'(\d{4}/\d{1,2}/\d{1,2})',
    ]:
        m = re.search(fmt, raw)
        if m:
            dt = m.group(1)
            # 补全秒数
            if re.match(r'\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}$', dt):
                dt += ':00'
            return dt
    return None


def normalize_product(name):
    """清理商品名"""
    if not name:
        return ''
    name = str(name).strip()
    name = re.sub(r'\s+', ' ', name)  # 合并空白
    name = name.replace('\n', ' ').replace('\r', '')
    return name.strip()


def read_excel(file_config):
    """读取Excel文件，返回订单列表"""
    print(f"\n📂 读取文件: {file_config['path'].split('/')[-1]}")
    wb = openpyxl.load_workbook(file_config['path'], data_only=True)
    # 自动找到有数据的sheet
    sheet_name = None
    for name in wb.sheetnames:
        if '订单' in name:
            sheet_name = name
            break
    if not sheet_name:
        sheet_name = wb.sheetnames[0]
    
    ws = wb[sheet_name]
    print(f"  Sheet: {sheet_name} ({ws.max_row} 行)")
    
    orders = []
    skip_count = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        
        order_no = str(row[file_config['col_order']]).strip()
        product = normalize_product(row[file_config['col_product']])
        customer = str(row[file_config['col_name']]).strip() if row[file_config['col_name']] else ''
        
        # 手机号可能在不同列
        phone = ''
        if 'col_phone' in file_config and file_config['col_phone'] < len(row):
            phone = str(row[file_config['col_phone']]).strip() if row[file_config['col_phone']] else ''
        
        # 清理手机号
        phone = re.sub(r'\D', '', phone)
        if len(phone) != 11:
            phone = ''
        
        # 规则4：没有手机号且没有名字则不导入
        if not phone and not customer:
            skip_count += 1
            continue
        
        # 金额
        amount = 0
        try:
            amount = float(row[file_config['col_amount']]) if row[file_config['col_amount']] is not None else 0
        except:
            pass
        
        # 支付时间
        pay_time = ''
        if file_config['col_time'] < len(row):
            pay_time = parse_time(row[file_config['col_time']])
        
        orders.append({
            'order_no': order_no,
            'product': product,
            'customer': customer,
            'phone': phone,
            'amount': int(amount) if amount == int(amount) else amount,
            'pay_time': pay_time or '',
        })
    
    print(f"  ✅ 有效订单: {len(orders)} 条 (跳过 {skip_count} 条无姓名无手机)")
    return orders


def find_existing_courses(db):
    """从数据库中查找所有已有的课程系列名称"""
    try:
        rows = db.execute("SELECT id, name FROM CourseSeries").fetchall()
        courses = [(row[0], row[1]) for row in rows]
        
        # 也查 OnlineCourse
        oc_rows = db.execute("SELECT id, name FROM OnlineCourse").fetchall()
        for row in oc_rows:
            courses.append((row[0], row[1]))
        
        return courses
    except:
        return []


def fuzzy_match(product, existing_courses):
    """模糊匹配课程名，返回匹配到的课程ID列表"""
    if not product:
        return []
    
    matched_ids = []
    product_clean = product.lower().replace('《', '').replace('》', '').replace(' ', '')
    
    for cid, cname in existing_courses:
        cname_clean = cname.lower().replace('《', '').replace('》', '').replace(' ', '')
        
        # 精确匹配
        if product_clean == cname_clean:
            matched_ids.append(cid)
            continue
        
        # 包含匹配
        if len(product_clean) >= 4 and (product_clean in cname_clean or cname_clean in product_clean):
            matched_ids.append(cid)
            continue
        
        # 关键词匹配（取商品名前5个字符以上）
        if len(product_clean) >= 5:
            for i in range(len(product_clean) - 4):
                keyword = product_clean[i:i+5]
                if keyword in cname_clean:
                    matched_ids.append(cid)
                    break
    
    return matched_ids


def main():
    print("=" * 60)
    print("  荔枝微课订单导入工具")
    print("=" * 60)
    
    # 1. 读取两个Excel文件
    all_orders = []
    for fc in FILES:
        orders = read_excel(fc)
        all_orders.extend(orders)
    
    print(f"\n📊 总计读取: {len(all_orders)} 条订单")
    
    # 2. 规则3：去重（同一课程的同一人只留1条）
    dedup_key = {}
    for o in all_orders:
        # 去重key: 课程名 + 手机号(优先) / 名字
        dedup_id = o['phone'] if o['phone'] else o['customer']
        key = (o['product'], dedup_id)
        if key not in dedup_key:
            dedup_key[key] = o
        else:
            # 保留有手机号的版本
            existing = dedup_key[key]
            if not existing['phone'] and o['phone']:
                dedup_key[key] = o
    
    unique_orders = list(dedup_key.values())
    print(f"  🗑️ 去重后: {len(unique_orders)} 条 (去掉了 {len(all_orders) - len(unique_orders)} 条重复)")
    
    # 3. 连接到数据库
    print(f"\n🔗 连接数据库: {DB_PATH}")
    db = sqlite3.connect(DB_PATH)
    db.execute("PRAGMA journal_mode=WAL")
    
    # 获取已有课程
    existing_courses = find_existing_courses(db)
    print(f"  📚 数据库已有课程: {len(existing_courses)} 个")
    
    # 4. 准备orders表
    # 确保orders表有我们需要的数据字段
    db.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_no TEXT NOT NULL UNIQUE,
            member_id INTEGER DEFAULT 0,
            member_name TEXT DEFAULT '',
            member_phone TEXT DEFAULT '',
            order_type TEXT NOT NULL,
            source_type TEXT DEFAULT '',
            source_id TEXT DEFAULT '',
            title TEXT DEFAULT '',
            amount REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            pay_method TEXT DEFAULT '',
            paid_at DATETIME DEFAULT NULL,
            remark TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 5. 导入数据
    print(f"\n📥 开始导入 {len(unique_orders)} 条订单...")
    
    imported = 0
    skipped = 0
    matched_total = 0
    no_match_products = set()
    
    for o in unique_orders:
        try:
            # 模糊匹配课程
            matched_courses = fuzzy_match(o['product'], existing_courses)
            matched_ids = [str(cid) for cid in matched_courses]
            
            if matched_courses:
                matched_total += 1
            else:
                no_match_products.add(o['product'][:60])
            
            # 构建remark
            remark_parts = []
            if matched_ids:
                remark_parts.append(f"matched_series:{','.join(matched_ids)}")
            remark_parts.append("source:lizhi")
            remark = '; '.join(remark_parts)
            
            # 写入orders表
            db.execute("""
                INSERT OR IGNORE INTO orders 
                    (order_no, member_id, member_name, member_phone, order_type, 
                     source_type, source_id, title, amount, status, pay_method, paid_at, remark)
                VALUES (?, 0, ?, ?, 'online_course', 'lizhi', ?, ?, ?, 'paid', '微信', ?, ?)
            """, (
                o['order_no'],
                o['customer'][:100],
                o['phone'],
                o['order_no'],  # source_id
                o['product'][:200],
                o['amount'],
                o['pay_time'] or None,
                remark
            ))
            
            if db.total_changes > 0:
                imported += 1
            else:
                skipped += 1
                
        except Exception as e:
            print(f"  ❌ 导入失败: {o['order_no']} - {e}")
            skipped += 1
    
    db.commit()
    
    # 6. 统计
    print(f"\n{'='*60}")
    print(f"  📋 导入完成！")
    print(f"  {'='*60}")
    print(f"  总读取:     {len(all_orders)} 条")
    print(f"  去重后:     {len(unique_orders)} 条")
    print(f"  已导入:     {imported} 条")
    print(f"  跳过(重复): {skipped} 条")
    print(f"  匹配到课程: {matched_total} 条")
    print(f"  未匹配课程: {len(no_match_products)} 个")
    print()
    
    if no_match_products:
        print(f"  ⚠️ 未匹配的课程名 (前20):")
        for p in sorted(list(no_match_products))[:20]:
            print(f"    - {p}")
    
    # 验证
    count = db.execute("SELECT COUNT(*) FROM orders WHERE source_type='lizhi'").fetchone()[0]
    total_amount = db.execute("SELECT SUM(amount) FROM orders WHERE source_type='lizhi'").fetchone()[0] or 0
    print(f"\n  ✅ 数据库中荔枝订单总量: {count} 条")
    print(f"  ✅ 总金额: ¥{total_amount:,.0f}")
    
    db.close()
    print(f"\n  🎉 导入完成！退出生效。")


if __name__ == '__main__':
    main()
