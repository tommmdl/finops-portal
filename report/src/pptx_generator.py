"""
Gera o PowerPoint mensal de FinOps a partir do template.
"""
import io
import copy
from datetime import date
from pathlib import Path

MESES_PT = {
    "January": "Janeiro", "February": "Fevereiro", "March": "Março",
    "April": "Abril", "May": "Maio", "June": "Junho",
    "July": "Julho", "August": "Agosto", "September": "Setembro",
    "October": "Outubro", "November": "Novembro", "December": "Dezembro",
}

def _month_str_pt(d: date) -> str:
    en = d.strftime("%B %Y")
    month_en, year = en.split(" ")
    return f"{MESES_PT[month_en]} {year}"

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN


# ── Paleta e-core ─────────────────────────────────────────────────────────────
BLUE_DARK  = "#1F4E79"
BLUE_MID   = "#2E75B6"
BLUE_LIGHT = "#BDD7EE"
ORANGE     = "#F4B942"
GRAY       = "#595959"
WHITE      = "#FFFFFF"

CHART_COLORS = [BLUE_DARK, BLUE_MID, BLUE_LIGHT, ORANGE, "#70AD47",
                "#ED7D31", "#A5A5A5", "#4472C4", "#9E480E", "#636363"]


# ── Utilitários de gráfico ────────────────────────────────────────────────────

def _chart_to_image(fig) -> io.BytesIO:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    buf.seek(0)
    plt.close(fig)
    return buf


def _bar_chart_evolucao(totals: dict) -> io.BytesIO:
    """Gráfico de barras: evolução total de custos 6 meses."""
    months = list(totals.keys())
    values = list(totals.values())

    fig, ax = plt.subplots(figsize=(8, 4.5), facecolor="white")
    bars = ax.bar(months, values, color=BLUE_MID, width=0.55, zorder=3)

    ax.set_facecolor("white")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(
        lambda x, _: f"${x:,.0f}"))
    ax.tick_params(axis="x", labelsize=9, rotation=15)
    ax.tick_params(axis="y", labelsize=9)
    ax.spines[["top", "right"]].set_visible(False)
    ax.yaxis.grid(True, linestyle="--", alpha=0.5, zorder=0)

    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max(values) * 0.01,
                f"${val:,.0f}", ha="center", va="bottom", fontsize=8, fontweight="bold",
                color=BLUE_DARK)

    ax.set_title("Evolução de Custos AWS — 6 Meses", fontsize=11,
                 fontweight="bold", color=BLUE_DARK, pad=12)
    fig.tight_layout()
    return _chart_to_image(fig)


def _bar_chart_top10(top10: pd.DataFrame, last3_months: list[str]) -> io.BytesIO:
    """Eixo X = meses; dentro de cada mês, uma barra por serviço (cor única por serviço)."""
    services  = top10["Service"].tolist()
    n_svc     = len(services)
    n_months  = len(last3_months)
    w         = 0.7 / n_svc
    x_base    = list(range(n_months))

    svc_colors = ["#1F4E79","#4472C4","#00B0F0","#375623","#7030A0",
                  "#FFC000","#ED7D31","#FF0000","#E6B8A2","#C00000"]

    fig, ax = plt.subplots(figsize=(10, 5), facecolor="white")
    ax.set_facecolor("white")

    for i, (svc, color) in enumerate(zip(services, svc_colors)):
        offsets = [xi + (i - n_svc / 2 + 0.5) * w for xi in x_base]
        vals    = [float(top10.loc[top10["Service"] == svc, m].values[0])
                   if m in top10.columns else 0 for m in last3_months]
        ax.bar(offsets, vals, width=w * 0.92, label=svc, color=color, zorder=3)

    ax.set_xticks(x_base)
    ax.set_xticklabels(last3_months, fontsize=10)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"${v:,.2f}"))
    ax.tick_params(axis="y", labelsize=9)
    ax.spines[["top", "right"]].set_visible(False)
    ax.yaxis.grid(True, linestyle="--", alpha=0.4, zorder=0)
    ax.legend(fontsize=7.5, loc="lower center",
              bbox_to_anchor=(0.5, -0.32), ncol=5, frameon=False)

    fig.tight_layout()
    return _chart_to_image(fig)


# ── Helpers de PPTX ───────────────────────────────────────────────────────────

def _replace_picture(slide, shape_idx: int, image_buf: io.BytesIO):
    """Substitui uma shape PICTURE pelo conteúdo de image_buf."""
    old = slide.shapes[shape_idx]
    left, top, width, height = old.left, old.top, old.width, old.height
    sp = old._element
    sp.getparent().remove(sp)
    slide.shapes.add_picture(image_buf, left, top, width, height)


def _set_text(shape, text: str):
    """Substitui o texto de um TextFrame preservando a formatação do primeiro run."""
    tf = shape.text_frame
    for para in tf.paragraphs:
        for run in para.runs:
            run.text = ""
    if tf.paragraphs:
        para = tf.paragraphs[0]
        if para.runs:
            para.runs[0].text = text
        else:
            para.add_run().text = text


def _set_cell_text(cell, text: str, align=PP_ALIGN.CENTER):
    """
    Atualiza o texto de uma célula PRESERVANDO a formatação original
    (cor, negrito, tamanho). Não usa cell.text= para evitar reset de estilo.
    """
    tf = cell.text_frame
    # Mantém só o primeiro parágrafo
    while len(tf.paragraphs) > 1:
        p = tf.paragraphs[len(tf.paragraphs) - 1]._p
        p.getparent().remove(p)
    para = tf.paragraphs[0]
    para.alignment = align
    # Mantém só o primeiro run
    while len(para.runs) > 1:
        r = para.runs[len(para.runs) - 1]._r
        r.getparent().remove(r)
    if para.runs:
        para.runs[0].text = text
    else:
        para.add_run().text = text


def _update_table(table, data: list[list]):
    """Atualiza uma tabela existente redimensionando linhas se necessário,
    PRESERVANDO a formatação original de cada célula."""
    n_rows_needed = len(data)
    n_rows_have   = len(table.rows)

    # Clonar última linha de dados para adicionar se precisar de mais
    if n_rows_needed > n_rows_have:
        last_tr = table.rows[n_rows_have - 1]._tr
        for _ in range(n_rows_needed - n_rows_have):
            new_tr = copy.deepcopy(last_tr)
            last_tr.getparent().append(new_tr)

    # Remover linhas excedentes
    while len(table.rows) > n_rows_needed:
        tr = table.rows[len(table.rows) - 1]._tr
        tr.getparent().remove(tr)

    for r, row_data in enumerate(data):
        for c, val in enumerate(row_data):
            if c >= len(table.columns):
                break
            _set_cell_text(table.cell(r, c), str(val))


def _fmt_brl(value: float) -> str:
    s = f"{abs(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"${s}" if value >= 0 else f"-${s}"


def _rebuild_oscillation_table(slide, table_shape_idx: int,
                                osc_df: pd.DataFrame, month_cols: list[str]):
    """Reconstrói a tabela de oscilações com dados dinâmicos."""
    shape = slide.shapes[table_shape_idx]
    table = shape.table

    header = ["Service"] + month_cols + ["Média", "Aumento"]
    rows = [header]
    for _, row in osc_df.iterrows():
        vals = [float(row[m]) if m in row.index else 0.0 for m in month_cols]
        avg  = sum(vals) / len(vals) if vals else 0
        inc  = (vals[-1] / avg - 1) if avg != 0 else 0
        r    = [row["Service"]]
        r   += [_fmt_brl(v) for v in vals]
        r   += [_fmt_brl(avg), f"{inc:.2%}".replace(".", ",")]
        rows.append(r)

    _update_table(table, rows)


def _rebuild_coverage_table(slide, shape_idx: int, coverage_df: pd.DataFrame,
                             utilization_df: pd.DataFrame):
    """Reconstrói a tabela de cobertura e utilização."""
    shape = slide.shapes[shape_idx]
    table = shape.table
    months = coverage_df["Mês"].tolist() if not coverage_df.empty else []

    header = ["Cobertura"] + months + ["", "Utilização"] + months
    rows = [header]
    for svc in ["Compute Savings Plans", "RDS"]:
        row = [svc]
        for m in months:
            val = coverage_df[coverage_df["Mês"] == m]["CoveragePercentage"]
            row.append(f"{val.values[0]:.0%}" if len(val) else "0%")
        row.append("")
        row.append(svc)
        for m in months:
            val = utilization_df[utilization_df["Mês"] == m]["UtilizationPercentage"]
            row.append(f"{val.values[0]:.0%}" if len(val) else "0%")
        rows.append(row)

    _update_table(table, rows)


# ── Entry point ───────────────────────────────────────────────────────────────

def generate(
    costs_df: pd.DataFrame,
    coverage_df: pd.DataFrame,
    utilization_df: pd.DataFrame,
    recommendations: list[dict],
    client_name: str,
    reference: date,
    template_path: Path,
    output_dir: Path,
) -> Path:
    month_str  = _month_str_pt(reference)
    month_cols = [c for c in costs_df.columns if c != "Service"]

    prs = Presentation(str(template_path))

    # ── Slide 1: Capa — só troca o nome do cliente, preserva toda formatação ──
    slide1 = prs.slides[0]
    for shape in slide1.shapes:
        if not shape.has_text_frame:
            continue
        for para in shape.text_frame.paragraphs:
            for run in para.runs:
                # Troca qualquer nome de cliente conhecido pelo nome correto
                for known in ["Wilson Sons", "Delta Energia", "Easy Carros",
                               "Compliance", "Rediseg", "Ubots"]:
                    if known in run.text:
                        run.text = run.text.replace(known, client_name)

    # ── Slide 2: Evolução 6 meses (substituir gráfico) ────────────────────────
    slide2 = prs.slides[1]
    totals = {m: costs_df[m].sum() for m in month_cols}
    chart_buf = _bar_chart_evolucao(totals)

    # Encontra a picture maior (o gráfico) — maior área
    pictures = [(i, s) for i, s in enumerate(slide2.shapes)
                if str(s.shape_type) == "PICTURE (13)" and s.width > 2000000]
    if pictures:
        idx = max(pictures, key=lambda x: x[1].width * x[1].height)[0]
        _replace_picture(slide2, idx, chart_buf)

    # ── Slide 3: Top 10 serviços (substituir gráfico) ─────────────────────────
    slide3 = prs.slides[2]
    top10   = costs_df.nlargest(10, month_cols[-1])
    last3   = month_cols[-3:]
    chart_buf2 = _bar_chart_top10(top10, last3)

    pictures3 = [(i, s) for i, s in enumerate(slide3.shapes)
                 if str(s.shape_type) == "PICTURE (13)" and s.width > 2000000]
    if pictures3:
        idx3 = max(pictures3, key=lambda x: x[1].width * x[1].height)[0]
        _replace_picture(slide3, idx3, chart_buf2)

    # ── Slide 4: Maior oscilação (atualizar tabela) ───────────────────────────
    # Apenas serviços com gasto real no último mês (>= $10) e com aumento efetivo
    slide4   = prs.slides[3]
    df_copy  = costs_df.copy()
    df_copy["_avg"] = df_copy[month_cols].mean(axis=1)
    df_copy["_inc"] = df_copy.apply(
        lambda r: (r[month_cols[-1]] / r["_avg"] - 1) if r["_avg"] != 0 else 0, axis=1
    )
    MIN_SPEND = 10.0
    osc_df = (
        df_copy[
            (df_copy[month_cols[-1]] >= MIN_SPEND) &   # elimina centavos
            (df_copy["_inc"] > 0)                       # só aumentos reais
        ]
        .nlargest(10, "_inc")[["Service"] + month_cols]
        .reset_index(drop=True)
    )

    table_shapes = [(i, s) for i, s in enumerate(slide4.shapes) if s.has_table]
    if table_shapes:
        _rebuild_oscillation_table(slide4, table_shapes[0][0], osc_df, month_cols)

    # ── Slide 5: Cobertura e Utilização (manual — não tocar se vazio) ────────
    if not coverage_df.empty:
        slide5 = prs.slides[4]
        cov_tables = [(i, s) for i, s in enumerate(slide5.shapes) if s.has_table]
        if cov_tables:
            _rebuild_coverage_table(slide5, cov_tables[0][0], coverage_df, utilization_df)

    # ── Slide 6: Pontos de Atenção (atualizar texto) ──────────────────────────
    slide6 = prs.slides[5]
    if recommendations:
        pontos_text = "Itens que requerem atenção:\n"
        for rec in recommendations[:5]:
            pontos_text += f"\n• {rec['Recurso']} — Economia: ${rec['Economia']:,.2f}/mês"
        for shape in slide6.shapes:
            if shape.has_text_frame and "Itens que requerem" in shape.text_frame.text:
                _set_text(shape, pontos_text)

    # ── Salvar ────────────────────────────────────────────────────────────────
    filename = f"{client_name} _ Report Mensal {month_str}.pptx"
    path = output_dir / filename
    prs.save(str(path))
    return path
