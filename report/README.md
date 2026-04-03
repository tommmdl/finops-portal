# 📊 FinOps Report — Automação de Reports Mensais AWS

Geração automática de **Excel** e **PowerPoint** mensais de FinOps a partir do export CSV do AWS Cost Explorer.

---

## ✨ O que ele faz

A partir de um CSV exportado do Cost Explorer, o projeto gera:

**Excel** com 8 abas:
| Aba | Conteúdo |
|-----|----------|
| Dados Base | Todos os serviços × últimos 6 meses |
| Detalhamento 6 meses | Mesmos dados + Média e % de Aumento |
| Evolução Custos AWS | Total mensal + gráfico de barras |
| Top Ten Serviços | Top 10 por gasto no último mês + gráfico agrupado por mês |
| Serviços com maior oscilação | Aumentos > 30% e todas as quedas |
| Cobertura Atual de Reservas | Cobertura e utilização de Savings Plans (preenchimento manual) |
| Economia - Aquisição de Reservas | Economia mensal/anual por reserva (preenchimento manual) |
| Pontos de Atenção - CloudCheckr | Recomendações de economia (preenchimento manual) |

**PowerPoint** com slides dinâmicos sobre o template da e-core:
- Slide 1 → Capa com nome do cliente
- Slide 2 → Gráfico de evolução de custos (6 meses)
- Slide 3 → Gráfico Top 10 serviços (últimos 3 meses, agrupado por mês)
- Slide 4 → Tabela dos 10 serviços com maior aumento real (filtro ≥ $10)
- Slides 5–9 → Dados manuais / estáticos preservados do template

---

## 🗂️ Estrutura do Projeto

```
finops-report/
├── src/
│   ├── main.py              # CLI principal
│   ├── extractor.py         # Leitura e transformação do CSV
│   ├── excel_generator.py   # Geração do Excel (8 abas)
│   └── pptx_generator.py    # Geração do PowerPoint
├── config/
│   ├── wilson-sons.yaml
│   ├── delta-energia.yaml
│   └── ...                  # Um YAML por cliente
├── templates/
│   └── template.pptx        # Template base do PowerPoint
├── input/                   # CSVs dos clientes (não versionado)
│   └── wilson-sons/
│       └── 2026-03/
│           └── costs.csv
├── output/                  # Arquivos gerados (não versionado)
└── requirements.txt
```

---

## 🚀 Como usar

### 1. Instalar dependências

```bash
pip install -r requirements.txt
```

### 2. Exportar o CSV do Cost Explorer

No console AWS:
1. Acesse **Billing → Cost Explorer**
2. Configure o período desejado (mínimo 6 meses)
3. Agrupe por **Service**
4. Exporte como CSV
5. Salve em `input/<cliente>/<YYYY-MM>/costs.csv`

### 3. Gerar o report

```bash
# Gerar Excel + PowerPoint para um cliente
python src/main.py --client wilson-sons --month 2026-03

# Apenas Excel
python src/main.py --client wilson-sons --month 2026-03 --only excel

# Apenas PowerPoint
python src/main.py --client wilson-sons --month 2026-03 --only pptx

# Informar o CSV manualmente
python src/main.py --client wilson-sons --month 2026-03 --csv caminho/costs.csv

# Rodar para todos os clientes configurados
python src/main.py --all --month 2026-03
```

Os arquivos gerados ficam em `output/`:
```
output/Wilson Sons _ Report Mensal Março 2026.xlsx
output/Wilson Sons _ Report Mensal Março 2026.pptx
```

---

## ⚙️ Configuração de clientes

Cada cliente tem um arquivo YAML em `config/`:

```yaml
# config/wilson-sons.yaml
name: Wilson Sons
report_title: "Wilson Sons _ Report Mensal"
aws_account_id: "391747331706"
aws_profile: "wilson-sons"
currency_symbol: "$"
usd_brl_rate: 5.5
```

---

## 📦 Dependências

| Pacote | Uso |
|--------|-----|
| `pandas` | Leitura e transformação do CSV |
| `openpyxl` | Geração do Excel |
| `matplotlib` | Gráficos embebidos no Excel e PPTX |
| `python-pptx` | Manipulação do PowerPoint |
| `python-dateutil` | Cálculo de meses relativos |
| `click` | Interface de linha de comando |
| `pyyaml` | Leitura dos configs de clientes |

---

## 👥 Clientes configurados

| Slug | Cliente |
|------|---------|
| `wilson-sons` | Wilson Sons |
| `delta-energia` | Delta Energia |
| `easy-carros` | Easy Carros |
| `compliance` | Compliance |
| `rediseg` | Rediseg |
| `ubots` | Ubots |
