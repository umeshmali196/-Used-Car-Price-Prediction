from pathlib import Path
import textwrap


OUTPUT = Path("Used_Car_Project_Problem_Solves.pdf")


title = "Real-World Problems Solved by the Used-Car Valuation Platform"

sections = [
    (
        "1. Unclear Used-Car Resale Value",
        "Many sellers and buyers do not know the correct resale value of a used car. "
        "This project solves that problem by calculating an estimated fair price using car details "
        "such as year, kilometers driven, brand, fuel type, ownership, city, service history, "
        "insurance, and inspection condition.",
    ),
    (
        "2. Overpricing and Underpricing Fraud",
        "In the used-car market, some cars are overpriced and some are sold too cheaply. "
        "The platform compares predicted price with market value and shows a Low, Fair, or High "
        "price label. This helps buyers avoid overpriced cars and helps sellers avoid selling below value.",
    ),
    (
        "3. No Proper Inspection-Based Price Adjustment",
        "A car's condition strongly affects resale value, but many simple prediction systems ignore it. "
        "This project includes an inspection checklist for engine condition, tyre condition, documents, "
        "accident signs, and service records. The inspection score adjusts the final valuation.",
    ),
    (
        "4. Lack of City-Wise Market Comparison",
        "Used-car prices change from city to city. A car may sell for a different price in Delhi, Mumbai, "
        "Bengaluru, Pune, or Hyderabad. This platform includes location/city details and gives a market "
        "comparison so the user gets a more practical valuation.",
    ),
    (
        "5. Poor Buyer-Seller Trust",
        "Buyers often hesitate because they do not know whether the asking price is fair. Sellers also "
        "struggle to prove their price. The system provides a valuation report, inspection score, "
        "document upload flow, and fair price label to increase trust between buyer and seller.",
    ),
    (
        "6. No Organized Car Listing System",
        "A normal prediction project only gives a price and stops there. This project allows users to "
        "create a car sale listing after valuation. Buyers can browse cars and filter by brand, city, "
        "fuel type, and price. This makes the project useful as a small marketplace.",
    ),
    (
        "7. Difficulty Managing Users and Platform Activity",
        "Real platforms need admin control. The admin dashboard solves this by showing total users, active "
        "users, predictions today, total listings, pending listings, charts, recent predictions, user "
        "management, and listing approval or blocking.",
    ),
    (
        "8. No Report or Certificate for Valuation",
        "Users often need a report to share with buyers, sellers, dealers, or for personal records. "
        "This project includes a PDF-style valuation report preview with expected price, market comparison, "
        "inspection score, price range, and depreciation estimate.",
    ),
    (
        "9. Missing Document Verification Flow",
        "Important documents like RC book, insurance, PUC, and service records affect trust and resale value. "
        "The project adds document upload sections so the platform can later support admin verification.",
    ),
    (
        "10. Lack of Smart Selling Guidance",
        "Many sellers do not know when to sell or which repairs improve resale value. The project includes "
        "AI suggestion panels such as best time to sell, expected depreciation, and repair suggestions.",
    ),
    (
        "11. Separate Admin Security",
        "Admin access should not be mixed with normal user login. The project solves this by adding separate "
        "admin login and admin signup pages, so admin accounts can be managed separately from normal users.",
    ),
    (
        "12. Complete Real-Life Use Case",
        "Overall, the project solves unfair and confusing used-car pricing by combining AI-based valuation, "
        "market comparison, inspection scoring, listing management, buyer filtering, PDF reports, document "
        "flow, notifications, and admin control in one platform.",
    ),
]

summary = [
    "Main users helped: car sellers, car buyers, and platform admins.",
    "Main benefit: transparent, fair, and inspection-based used-car pricing.",
    "Project type: AI used-car valuation, marketplace, and admin management platform.",
]


def escape_pdf_text(value):
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def page_stream(lines):
    y = 790
    commands = ["BT", "/F1 18 Tf", "72 790 Td"]
    first = True
    for text, size, gap in lines:
        if first:
            commands[-1] = f"72 {y} Td"
            first = False
        else:
            y -= gap
            commands.append(f"72 {y} Td")
        commands.append(f"/F1 {size} Tf")
        commands.append(f"({escape_pdf_text(text)}) Tj")
    commands.append("ET")
    return "\n".join(commands).encode("latin-1", "replace")


def build_pages():
    pages = []
    current = [(title, 16, 0), ("", 10, 24)]

    for line in summary:
        current.append((line, 10, 16))

    current.append(("", 10, 20))

    used_lines = 6
    for heading, body in sections:
        wrapped = textwrap.wrap(body, width=88)
        needed = 2 + len(wrapped)
        if used_lines + needed > 38:
            pages.append(current)
            current = []
            used_lines = 0

        current.append((heading, 12, 20 if current else 0))
        for line in wrapped:
            current.append((line, 10, 14))
        used_lines += needed

    if current:
        pages.append(current)

    return pages


def make_pdf():
    objects = []

    def add_object(content):
        objects.append(content)
        return len(objects)

    catalog_id = add_object(b"<< /Type /Catalog /Pages 2 0 R >>")
    pages_id = add_object(b"")
    font_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    page_ids = []
    for lines in build_pages():
        stream = page_stream(lines)
        stream_id = add_object(
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"
        )
        page_id = add_object(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            b"/Resources << /Font << /F1 3 0 R >> >> /Contents "
            + str(stream_id).encode()
            + b" 0 R >>"
        )
        page_ids.append(page_id)

    objects[pages_id - 1] = (
        b"<< /Type /Pages /Kids ["
        + b" ".join(str(page_id).encode() + b" 0 R" for page_id in page_ids)
        + b"] /Count "
        + str(len(page_ids)).encode()
        + b" >>"
    )

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode())
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref_position = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())
    pdf.extend(
        b"trailer\n<< /Size "
        + str(len(objects) + 1).encode()
        + b" /Root "
        + str(catalog_id).encode()
        + b" 0 R >>\nstartxref\n"
        + str(xref_position).encode()
        + b"\n%%EOF\n"
    )

    OUTPUT.write_bytes(pdf)


if __name__ == "__main__":
    make_pdf()
    print(OUTPUT.resolve())
