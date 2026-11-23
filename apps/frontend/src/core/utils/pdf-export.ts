import type { WeeklyMenuExportWeek } from './excel-export';

/**
 * Export up to 3 most recent weekly menus to PDF via an in-page layout iframe
 * (avoiding about:blank popup issues and Chromium rotation glitches), matching the
 * colored matrix format with school logo and school name.
 * Supports both landscape (bảng rộng chuẩn) and portrait (khổ đứng A4 đọc xuôi).
 */
export function exportWeeklyMenusToPdf(params: {
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  logoUrl?: string | null;
  childName?: string;
  weeks: WeeklyMenuExportWeek[];
  orientation?: 'landscape' | 'portrait';
}): boolean {
  const orientation = params.orientation || 'portrait';
  const isPortrait = orientation === 'portrait';

  const escapeHtml = (val: unknown) =>
    String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const resolvedLogoUrl = (() => {
    if (!params.logoUrl) return '';
    try {
      return new URL(params.logoUrl, window.location.origin).href;
    } catch {
      return params.logoUrl;
    }
  })();

  const headerColors = ['#538DD5', '#76933C', '#FABF8F', '#92CDDC', '#8064A2', '#4BACC6', '#F79646'];

  const argbToCss = (argb: string) => {
    const clean = argb.replace(/^FF/i, '');
    return clean.length === 6 ? `#${clean}` : '#F8FAFC';
  };

  const weeksHtml = params.weeks
    .map((week, idx) => {
      const headerCols = week.days
        .map(
          (d, dIdx) => `
          <th style="background:${headerColors[dIdx % headerColors.length]};">
            <div>${escapeHtml(d.weekdayLabel)}</div>
            <div>${escapeHtml(d.dateLabel)}</div>
          </th>`,
        )
        .join('');

      const bodyRows = week.rows
        .map((row) => {
          const cells = row.cells
            .map((text) => {
              const linesHtml = text
                ? text
                    .split('\n')
                    .map((line) => `<div>${escapeHtml(line)}</div>`)
                    .join('')
                : '<div class="empty">—</div>';
              return `<td>${linesHtml}</td>`;
            })
            .join('');

          return `
            <tr>
              <td class="meal-col" style="background:${argbToCss(row.bgColor)};">
                ${escapeHtml(row.mealLabel).replace(/\n/g, '<br/>')}
              </td>
              ${cells}
            </tr>`;
        })
        .join('');

      const logoHtml = resolvedLogoUrl
        ? `<img src="${escapeHtml(resolvedLogoUrl)}" alt="Logo" class="school-logo" />`
        : '';

      return `
        <section class="week-page ${idx < params.weeks.length - 1 ? 'page-break' : ''}">
          <div class="header">
            <div class="school-brand">
              ${logoHtml}
              <div>
                <div class="school-name">${escapeHtml(params.schoolName)}</div>
                ${
                  params.schoolAddress || params.schoolPhone
                    ? `<div class="school-meta">${escapeHtml(
                        [params.schoolAddress, params.schoolPhone ? `ĐT: ${params.schoolPhone}` : '']
                          .filter(Boolean)
                          .join(' · '),
                      )}</div>`
                    : ''
                }
              </div>
            </div>
            <div class="week-meta">
              <div class="week-title">${escapeHtml(String(week.title || '').replace(/\s*\([^)]*\)/g, '').trim())} · ${escapeHtml(week.dateRange)}</div>
              <div class="week-sub">
                ${escapeHtml(String(week.ageGroupLabel || '').replace(/\s*\([^)]*\)/g, '').trim())}
                ${params.childName ? ` · Học sinh: ${escapeHtml(params.childName)}` : ''}
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th class="corner-col">Thứ<br/>Bữa</th>
                ${headerCols}
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>
        </section>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(params.schoolName)} - Thực đơn ${params.weeks.length} tuần</title>
  <style>
    @page {
      size: ${isPortrait ? 'portrait' : 'landscape'};
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: "Times New Roman", "Segoe UI", Arial, sans-serif;
    }
    body {
      padding: 10px;
    }
    .week-page {
      margin-bottom: 24px;
      page-break-after: always;
      break-after: page;
    }
    .week-page:last-child {
      margin-bottom: 0;
      page-break-after: auto;
      break-after: auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 2px solid #0f172a;
    }
    .school-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .school-logo {
      width: ${isPortrait ? '38px' : '46px'};
      height: ${isPortrait ? '38px' : '46px'};
      object-fit: contain;
      border-radius: 4px;
    }
    .school-name {
      font-size: ${isPortrait ? '13px' : '15px'};
      font-weight: 700;
      text-transform: uppercase;
      color: #0f172a;
    }
    .school-meta {
      font-size: ${isPortrait ? '10px' : '11px'};
      color: #475569;
      margin-top: 1px;
    }
    .week-meta {
      text-align: right;
    }
    .week-title {
      font-size: ${isPortrait ? '12px' : '14px'};
      font-weight: 700;
      color: #047857;
    }
    .week-sub {
      font-size: ${isPortrait ? '10px' : '11px'};
      color: #475569;
      margin-top: 1px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1.5px solid #1e293b;
      padding: ${isPortrait ? '5px 5px' : '7px 8px'};
      vertical-align: top;
      text-align: left;
      line-height: ${isPortrait ? '1.35' : '1.45'};
      font-size: ${isPortrait ? '10.5px' : '12px'};
    }
    th {
      text-align: center;
      vertical-align: middle;
      font-weight: 700;
      font-size: ${isPortrait ? '11px' : '12.5px'};
      color: #000;
    }
    th.corner-col {
      width: ${isPortrait ? '76px' : '110px'};
      background: #D99694;
    }
    td.meal-col {
      width: ${isPortrait ? '76px' : '110px'};
      text-align: center;
      vertical-align: middle;
      font-weight: 700;
      font-size: ${isPortrait ? '11px' : '12.5px'};
      color: #000;
    }
    td div {
      margin-bottom: 2px;
    }
    .empty {
      color: #64748b;
      font-style: italic;
      text-align: center;
    }
    @media print {
      @page {
        size: ${isPortrait ? 'portrait' : 'landscape'};
        margin: 8mm;
      }
      body {
        padding: 0;
      }
      .week-page {
        margin-bottom: 0;
      }
    }
  </style>
</head>
<body>
  ${weeksHtml}
</body>
</html>`;

  const existing = document.getElementById('kidmeal-pdf-print-frame');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'kidmeal-pdf-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = '100vw';
  iframe.style.height = '100vh';
  iframe.style.border = '0';
  iframe.style.zIndex = '-9999';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    const win = iframe.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
    setTimeout(() => {
      iframe.remove();
    }, 60000);
  };

  const imgs = Array.from(doc.images || []);
  if (imgs.length > 0) {
    Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }),
      ),
    ).then(() => setTimeout(triggerPrint, 150));
  } else {
    setTimeout(triggerPrint, 150);
  }

  return true;
}
