from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
from PIL import Image, ImageFilter, ImageOps


SOURCE_DIR = Path(__file__).resolve().parents[1]
SITE_DIR = SOURCE_DIR.parent / "官方网站"
IMAGE_OUT = SITE_DIR / "public" / "images" / "disciples"
DATA_OUT = SITE_DIR / "src" / "data" / "disciples.ts"
WORKBOOK = SOURCE_DIR / "伊娃弟子统计表.xlsx"
EXTRA_WORKBOOK = Path("/Users/lilei/Desktop/伊娃弟子统计表2.xlsx")
EXTRA_PHOTO_DIR = Path("/Users/lilei/Desktop")

CANVAS_SIZE = (900, 1200)
FOREGROUND_MAX = (820, 1120)


def js_string(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("`", "\\`")
        .replace("${", "\\${")
        .replace("\n", " ")
    )


def sanitize_slug(text: str, fallback: str) -> str:
    normalized = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", "-", text).strip("-")
    return normalized or fallback


def parse_location(address: str) -> tuple[str, str]:
    first_line = str(address).splitlines()[0]
    parts = [p for p in first_line.split("/") if p]
    province = parts[0].replace("省", "").replace("市", "") if parts else "中国"
    city = parts[1].replace("市", "") if len(parts) > 1 else province
    return province, city


def find_photo(photos: list[Path], filler: str, name: str) -> Path:
    matches = [photo for photo in photos if filler and filler in photo.name]
    if not matches:
        matches = [photo for photo in photos if name and name in photo.name]
    if matches:
        return max(matches, key=lambda photo: photo.stat().st_mtime)
    raise FileNotFoundError(f"Missing photo for {name} / {filler}")


def make_web_image(src: Path, dest: Path) -> None:
    with Image.open(src) as original:
        image = trim_dark_border(ImageOps.exif_transpose(original).convert("RGB"))

    bg = ImageOps.fit(image, CANVAS_SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.42))
    bg = bg.filter(ImageFilter.GaussianBlur(26))
    overlay = Image.new("RGB", CANVAS_SIZE, (118, 34, 34))
    bg = Image.blend(bg, overlay, 0.18)

    fg = image.copy()
    fg.thumbnail(FOREGROUND_MAX, Image.Resampling.LANCZOS)

    x = (CANVAS_SIZE[0] - fg.width) // 2
    y = (CANVAS_SIZE[1] - fg.height) // 2
    bg.paste(fg, (x, y))
    bg.save(dest, "WEBP", quality=88, method=6)


def trim_dark_border(image: Image.Image) -> Image.Image:
    gray = image.convert("L")
    mask = gray.point(lambda p: 255 if p > 18 else 0)
    bbox = mask.getbbox()
    if not bbox:
        return image

    left, top, right, bottom = bbox
    width, height = image.size
    trimmed_area = (right - left) * (bottom - top)
    full_area = width * height
    border_is_meaningful = trimmed_area < full_area * 0.96

    if border_is_meaningful:
        return image.crop(bbox)
    return image


def first_value(row: pd.Series, names: list[str]) -> str:
    for name in names:
        if name in row and not pd.isna(row[name]):
            return str(row[name]).strip()
    return ""


def title_for(row: pd.Series) -> str:
    filler = first_value(row, ["填写人（自动）", "填写人"])
    if any(key in filler for key in ["瑜伽", "舞蹈", "美学", "普拉提", "成人舞蹈", "老师"]):
        return "东方舞教学主理人"
    return "伊娃东方舞传承弟子"


BIO_OPENINGS = [
    "{name}在{city}持续深耕东方舞课堂，",
    "{name}以{city}为教学与创作起点，",
    "{name}将{join_month}的拜师学习沉淀进日常训练，",
    "{name}把细腻的身体觉察带入{city}的舞蹈课堂，",
    "{name}从师承体系中提炼方法，",
    "{name}专注于东方舞的线条、节奏与舞台表达，",
    "{name}在稳定训练中形成了温柔而有力量的教学风格，",
    "{name}珍视伊娃老师一脉相承的训练标准，",
]

BIO_MIDDLES = [
    "擅长把基础技巧讲得清楚、练得扎实，",
    "注重体态、核心与音乐理解的同步提升，",
    "课堂气质亲和细致，重视每一位学员的真实进步，",
    "以优雅表达和舞台质感作为长期修炼方向，",
    "善于把东方舞的女性力量转化为可学习的训练路径，",
    "在教学中兼顾审美、技巧和自信心建立，",
    "用耐心的陪伴帮助学员找到身体的舒展与节奏，",
    "重视动作细节，也鼓励学员打开属于自己的舞台状态，",
    "把传统韵味与现代课堂节奏结合得自然克制，",
    "以专业训练和真诚表达连接更多东方舞爱好者，",
]

BIO_ENDINGS = [
    "让舞蹈成为稳定而闪光的生命表达。",
    "继续传递东方舞的优雅、力量与美感。",
    "在一招一式中延展伊娃东方舞的师承温度。",
    "带领更多学员感受系统训练后的自信变化。",
    "以长期主义守护课堂品质与舞台质感。",
    "让每一次练习都更接近从容、明亮的自己。",
    "把热爱落在扎实训练里，也落在真实表达里。",
    "持续拓展属于东方舞老师的专业边界。",
]

TAG_POOL = [
    ["师徒传承", "东方舞教学", "舞台表达"],
    ["系统训练", "优雅体态", "课堂陪伴"],
    ["技巧精修", "音乐表达", "女性力量"],
    ["教学实践", "审美塑造", "长期精进"],
    ["身体觉察", "舞感提升", "传承体系"],
    ["基础训练", "细节打磨", "自信表达"],
]


def build_bio(index: int, name: str, city: str, join_month: str) -> str:
    opening = BIO_OPENINGS[index % len(BIO_OPENINGS)]
    middle = BIO_MIDDLES[(index * 3 + 1) % len(BIO_MIDDLES)]
    ending = BIO_ENDINGS[(index * 5 + 2) % len(BIO_ENDINGS)]
    return (opening + middle + ending).format(name=name, city=city, join_month=join_month)


def tags_for(index: int, province: str, title: str) -> list[str]:
    tags = TAG_POOL[index % len(TAG_POOL)].copy()
    tags[0] = "教学主理人" if "主理人" in title else tags[0]
    tags[-1] = province
    return tags


def main() -> None:
    IMAGE_OUT.mkdir(parents=True, exist_ok=True)
    dataframes = [pd.read_excel(WORKBOOK)]
    if EXTRA_WORKBOOK.exists():
        dataframes.append(pd.read_excel(EXTRA_WORKBOOK))
    df = pd.concat(dataframes, ignore_index=True)
    photos = sorted(
        [
            *SOURCE_DIR.glob("*.jpeg"),
            *SOURCE_DIR.glob("*.jpg"),
            *SOURCE_DIR.glob("*.png"),
            *SOURCE_DIR.glob("*.webp"),
            *EXTRA_PHOTO_DIR.glob("王海辉.*"),
            *EXTRA_PHOTO_DIR.glob("王琪.*"),
            *EXTRA_PHOTO_DIR.glob("曾小燕.*"),
            *EXTRA_PHOTO_DIR.glob("谭景卿.*"),
        ]
    )

    records: list[dict[str, str | int | list[str]]] = []
    for index, row in df.iterrows():
        name = first_value(row, ["姓名（必填）", "姓名"])
        display_name = first_value(row, ["填写人（自动）", "填写人"])
        join_month = first_value(row, ["拜师年月（必填）", "拜师年月-年月"])
        province, city = parse_location(first_value(row, ["地址（必填）", "地址"]))
        photo = find_photo(photos, display_name, name)
        slug = sanitize_slug(f"{index + 1:02d}-{name}", f"disciple-{index + 1:02d}")
        out_name = f"{slug}.webp"
        make_web_image(photo, IMAGE_OUT / out_name)

        title = title_for(row)
        records.append(
            {
                "id": index + 1,
                "name": name,
                "displayName": display_name,
                "photo": f"/images/disciples/{out_name}",
                "title": title,
                "joinYear": join_month,
                "province": province,
                "city": city,
                "bio": build_bio(index, name, city, join_month),
                "tags": tags_for(index, province, title),
            }
        )

    lines = [
        "export interface Disciple {",
        "  id: number;",
        "  name: string;",
        "  displayName: string;",
        "  photo: string;",
        "  title: string;",
        "  joinYear: string;",
        "  province: string;",
        "  city: string;",
        "  bio: string;",
        "  tags: string[];",
        "}",
        "",
        "export const disciples: Disciple[] = [",
    ]
    for record in records:
        lines.extend(
            [
                "  {",
                f"    id: {record['id']},",
                f"    name: `{js_string(str(record['name']))}`,",
                f"    displayName: `{js_string(str(record['displayName']))}`,",
                f"    photo: `{js_string(str(record['photo']))}`,",
                f"    title: `{js_string(str(record['title']))}`,",
                f"    joinYear: `{js_string(str(record['joinYear']))}`,",
                f"    province: `{js_string(str(record['province']))}`,",
                f"    city: `{js_string(str(record['city']))}`,",
                f"    bio: `{js_string(str(record['bio']))}`,",
                "    tags: [" + ", ".join(f"`{js_string(tag)}`" for tag in record["tags"]) + "],",
                "  },",
            ]
        )
    lines.extend(["];", ""])
    DATA_OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(records)} disciples")
    print(f"Images: {IMAGE_OUT}")
    print(f"Data: {DATA_OUT}")


if __name__ == "__main__":
    main()
