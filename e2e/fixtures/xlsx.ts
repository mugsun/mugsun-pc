import ExcelJS from 'exceljs'

/** e2e 构造/解析 xlsx（不用已停更的 sheetjs / xlsx） */
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function buildXlsx(
  sheetName: string,
  rows: Array<Record<string, unknown>>,
  headers?: string[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)
  const cols = headers ?? collectHeaders(rows)
  if (cols.length > 0) {
    ws.addRow(cols)
  }
  for (const row of rows) {
    ws.addRow(cols.map((h) => (row[h] === undefined || row[h] === null ? '' : row[h])))
  }
  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

export async function parseXlsxAoa(body: Buffer): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(body)
  const sheet = wb.worksheets[0]
  const aoa: unknown[][] = []
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as unknown[]
    aoa.push(values.slice(1))
  })
  return aoa
}

function collectHeaders(rows: Array<Record<string, unknown>>): string[] {
  const headers: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        headers.push(key)
      }
    }
  }
  return headers
}
