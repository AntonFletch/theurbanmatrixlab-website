#!/usr/bin/env python3
"""Export the CURRENT MX Continuity customer legal master from the live site sources.

Source of truth: the HTML articles in the same Git commit, never stale Library PDFs.
"""
from __future__ import annotations
import argparse
import datetime
import html
import re
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape
from bs4 import BeautifulSoup, NavigableString, Tag
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table as PDFTable, TableStyle, PageBreak, KeepTogether
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

ROOT=Path(__file__).resolve().parent.parent
DOCS=[
 ("Website Design & Care Service Agreement","terms.html"),
 ("Website Ownership & Handoff Terms","ownership.html"),
 ("Privacy Policy","privacy.html"),
 ("Refund Policy","refunds.html"),
 ("Cancellation Policy","cancellation.html"),
 ("Customer Project Order","project-order.html"),
 ("Change Order & Additional Work Authorization","change-order.html"),
 ("Separate Monthly Website Care Authorization","monthly-care-authorization.html")
]
OUT=ROOT/"exports"
GOLD=RGBColor(171,126,45)
DARK=RGBColor(29,25,39)
MUTED=RGBColor(88,80,96)

def text_of(node):
    return " ".join(node.get_text(" ",strip=True).split())

def blocks_from_html(file):
    text=(ROOT/file).read_text(encoding="utf-8")
    soup=BeautifulSoup(text,"html.parser")
    article=soup.select_one("article.policy-content")
    if not article:
        raise RuntimeError("Missing policy-content article: "+file)
    blocks=[]
    for element in article.children:
        if not isinstance(element,Tag): continue
        if element.name in ("h1","h2","h3"):
            blocks.append(("heading",int(element.name[1]),text_of(element)))
        elif element.name=="p":
            blocks.append(("paragraph",1,text_of(element)))
        elif element.name in ("ul","ol"):
            for li in element.find_all("li",recursive=False):
                blocks.append(("bullet",1,text_of(li)))
        elif element.name=="table":
            rows=[]
            for tr in element.select("tr"):
                rows.append([text_of(c) for c in tr.find_all(["th","td"],recursive=False)])
            if rows: blocks.append(("table",1,rows))
    if len(blocks)<5:raise RuntimeError("Abnormally short legal document "+file)
    return blocks

def shade(cell,color):
    tcpr=cell._tc.get_or_add_tcPr()
    sh=OxmlElement("w:shd");sh.set(qn("w:fill"),color);tcpr.append(sh)

def add_docx(data,path):
    d=Document();sec=d.sections[0];sec.top_margin=Inches(.7);sec.bottom_margin=Inches(.7)
    sec.left_margin=Inches(.8);sec.right_margin=Inches(.8)
    d.styles["Normal"].font.name="Aptos";d.styles["Normal"].font.size=Pt(9)
    d.styles["Normal"].paragraph_format.space_after=Pt(5)
    for style,size in (("Title",25),("Heading 1",17),("Heading 2",12),("Heading 3",10)):
        st=d.styles[style];st.font.name="Georgia";st.font.size=Pt(size);st.font.color.rgb=DARK
        st.paragraph_format.space_before=Pt(9)
        st.paragraph_format.space_after=Pt(5)
    head=d.sections[0].header.paragraphs[0]
    head.text="MX  /  CONTINUITY                                      CUSTOMER LEGAL MASTER"
    head.style="Caption"
    foot=d.sections[0].footer.paragraphs[0]
    foot.text="MX Continuity  ·  Current site-source master  ·  9 November 2026"
    foot.alignment=WD_ALIGN_PARAGRAPH.CENTER
    title=d.add_paragraph(style="Title");title.add_run("MX CONTINUITY")
    p=d.add_paragraph();p.style="Subtitle";p.add_run("Customer Legal & Authorization Master")
    p=d.add_paragraph();p.add_run("Source: current MX Continuity website files, GitHub main branch, 9 November 2026.")
    p=d.add_paragraph();p.add_run("This set contains reusable terms and blank customer forms. Individual agreements require the acceptance and signatures described in the documents. No payment or subscription is activated by this master.")
    d.add_heading("Contents",level=1)
    for i,(label,filename,_) in enumerate(data,1):
        d.add_paragraph(f"{i:02d}  {label}  ·  {filename}")
    d.add_page_break()
    for i,(label,filename,blocks) in enumerate(data):
        if i:d.add_page_break()
        p=d.add_paragraph(style="Subtitle");p.add_run(f"{i+1:02d}  /  {filename}")
        for kind,level,value in blocks:
            if kind=="heading":
                d.add_heading(value,level=min(level,3))
            elif kind=="paragraph":
                d.add_paragraph(value)
            elif kind=="bullet":
                d.add_paragraph(value,style="List Bullet")
            elif kind=="table":
                width=max(len(r) for r in value)
                tbl=d.add_table(rows=0,cols=width);tbl.style="Table Grid";tbl.alignment=WD_TABLE_ALIGNMENT.CENTER
                for rowno,raw in enumerate(value):
                    cells=tbl.add_row().cells
                    for col,val in enumerate(raw):
                        cells[col].text=val
                        cells[col].vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
                        for p in cells[col].paragraphs:
                            for run in p.runs:run.font.size=Pt(7.5)
                        if rowno==0:
                            shade(cells[col],"E8E0D5")
                            for p in cells[col].paragraphs:
                                for run in p.runs:run.bold=True
        d.add_paragraph("Website source: https://antonfletch.github.io/theurbanmatrixlab-website/"+filename,style="Caption")
    d.core_properties.title="MX Continuity | Customer Legal & Authorization Master"
    d.core_properties.subject="Current website-synchronized legal terms and customer authorization forms"
    d.save(path)

def add_pdf(data,path):
    pdf=SimpleDocTemplate(str(path),pagesize=letter,rightMargin=.75*inch,leftMargin=.75*inch,
                          topMargin=.75*inch,bottomMargin=.68*inch,title="MX Continuity | Customer Legal Master")
    st=getSampleStyleSheet()
    st.add(ParagraphStyle(name="MXTitle",fontName="Helvetica-Bold",fontSize=24,leading=28,textColor=colors.HexColor("#211a2e"),spaceAfter=16))
    st.add(ParagraphStyle(name="MXHeading1",fontName="Helvetica-Bold",fontSize=16,leading=19,textColor=colors.HexColor("#412b57"),spaceBefore=14,spaceAfter=8,keepWithNext=True))
    st.add(ParagraphStyle(name="MXHeading2",fontName="Helvetica-Bold",fontSize=11.5,leading=15,textColor=colors.HexColor("#946826"),spaceBefore=12,spaceAfter=6,keepWithNext=True))
    st.add(ParagraphStyle(name="MXHeading3",fontName="Helvetica-Bold",fontSize=10,leading=13,textColor=colors.HexColor("#946826"),spaceBefore=9,spaceAfter=4,keepWithNext=True))
    st.add(ParagraphStyle(name="MXBody",fontName="Helvetica",fontSize=8.7,leading=12.9,spaceAfter=7,wordWrap="CJK"))
    st.add(ParagraphStyle(name="MXSmall",fontName="Helvetica",fontSize=7,leading=9,textColor=colors.grey,spaceAfter=8,wordWrap="CJK"))
    st.add(ParagraphStyle(name="MXTable",fontName="Helvetica",fontSize=7,leading=9,wordWrap="CJK"))
    body=[]
    def para(s,style="MXBody"):
        s=xml_escape(s).replace("□","[ ]").replace("−","-").replace("—","-").replace("•","-")
        return Paragraph(s,st[style])
    body+=[para("MX CONTINUITY","MXTitle"),para("Customer Legal & Authorization Master","MXHeading1"),
           para("Current site-source copy | 9 November 2026"),
           para("Compiled from the current MX Continuity website files. These are reusable terms and blank customer forms, not executed customer agreements."),
           para("CONTENTS","MXHeading2")]
    for i,(label,filename,blocks) in enumerate(data,1):body.append(para(f"{i:02d}   {label} | {filename}"))
    for i,(label,filename,blocks) in enumerate(data,1):
        body.append(PageBreak())
        body.append(para(f"{i+1:02d} / {filename}","MXSmall"))
        for kind,level,value in blocks:
            if kind=="heading":body.append(para(value,{1:"MXHeading1",2:"MXHeading2",3:"MXHeading3"}.get(level,"MXHeading2")))
            elif kind=="paragraph":body.append(para(value))
            elif kind=="bullet":body.append(para(" - "+value))
            elif kind=="table":
                colcount=max(map(len,value))
                rows=[]
                for row in value:
                    row=row+[""]*(colcount-len(row))
                    rows.append([para(v,"MXTable") for v in row])
                widths=[(7*inch)/colcount]*colcount
                tbl=PDFTable(rows,colWidths=widths,repeatRows=1,hAlign="LEFT")
                tbl.setStyle(TableStyle([
                    ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#eee5d8")),
                    ("VALIGN",(0,0),(-1,-1),"TOP"),
                    ("GRID",(0,0),(-1,-1),.35,colors.HexColor("#bdb6b0")),
                    ("LEFTPADDING",(0,0),(-1,-1),6),
                    ("RIGHTPADDING",(0,0),(-1,-1),6),
                    ("TOPPADDING",(0,0),(-1,-1),5),
                    ("BOTTOMPADDING",(0,0),(-1,-1),5),
                ]))
                body.append(tbl);body.append(Spacer(1,10))
        body.append(para("Source: https://antonfletch.github.io/theurbanmatrixlab-website/"+filename,"MXSmall"))
    def footer(canv,doc):
        canv.saveState()
        canv.setFont("Helvetica",8);canv.setFillColor(colors.HexColor("#786b7e"))
        canv.drawString(.75*inch,.43*inch,"MX CONTINUITY  |  Current customer legal master")
        canv.drawRightString(7.75*inch,.43*inch,str(doc.page))
        canv.restoreState()
    pdf.build(body,onFirstPage=footer,onLaterPages=footer)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    data=[(label,filename,blocks_from_html(filename)) for label,filename in DOCS]
    for label,filename,blocks in data:
        if not any(b[0]=="heading" and b[1]==1 for b in blocks):raise RuntimeError("Heading missing: "+filename)
    add_docx(data,OUT/"MX_Continuity_Legal_Master.docx")
    add_pdf(data,OUT/"MX_Continuity_Legal_Master.pdf")
    for p in sorted(OUT.iterdir()):print(str(p),p.stat().st_size)
    print("Exported "+str(len(data))+" complete current website legal documents.")

if __name__=="__main__": main()
