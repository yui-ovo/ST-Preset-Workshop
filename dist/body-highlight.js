function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

function tokenizeDiffText(text) {
  /* 中文逐字，英文/数字按词，空白成组；既能精确标中文，又不会把英文拆得太碎 */
  return String(text || '').match(/[\u3400-\u9FFF]|[A-Za-z0-9_]+|\s+|[^\s]/gu) || [];
}

function sameRun(a, ai, b, bi, need = 3) {
  let count = 0;
  while (ai + count < a.length && bi + count < b.length && a[ai + count] === b[bi + count]) {
    count++;
    if (count >= need) return true;
  }
  return count >= need || (ai + count === a.length && bi + count === b.length && count > 0);
}

export function buildHighlightedDiff(leftText, rightText) {
  const left = tokenizeDiffText(leftText);
  const right = tokenizeDiffText(rightText);
  const outA = [];
  const outB = [];
  let i = 0, j = 0;
  const WINDOW = 48;

  const pushSame = token => {
    const h = esc(token);
    outA.push(h);
    outB.push(h);
  };
  const pushDiffA = tokens => {
    if (!tokens.length) return;
    outA.push('<mark class="pmm-diff-mark pmm-diff-mark-a">' + esc(tokens.join('')) + '</mark>');
  };
  const pushDiffB = tokens => {
    if (!tokens.length) return;
    outB.push('<mark class="pmm-diff-mark pmm-diff-mark-b">' + esc(tokens.join('')) + '</mark>');
  };

  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      pushSame(left[i]);
      i++; j++;
      continue;
    }

    if (i >= left.length) {
      pushDiffB(right.slice(j));
      j = right.length;
      break;
    }
    if (j >= right.length) {
      pushDiffA(left.slice(i));
      i = left.length;
      break;
    }

    let best = null;
    const maxA = Math.min(WINDOW, left.length - i);
    const maxB = Math.min(WINDOW, right.length - j);

    /* 在附近寻找重新对齐点。允许单边插入/删除。 */
    for (let da = 0; da <= maxA; da++) {
      for (let db = 0; db <= maxB; db++) {
        if (da === 0 && db === 0) continue;
        if (i + da >= left.length || j + db >= right.length) continue;
        if (left[i + da] !== right[j + db]) continue;
        if (!sameRun(left, i + da, right, j + db, 3)) continue;

        const cost = da + db + Math.abs(da - db) * .15;
        if (!best || cost < best.cost) best = { da, db, cost };
      }
    }

    if (best) {
      pushDiffA(left.slice(i, i + best.da));
      pushDiffB(right.slice(j, j + best.db));
      i += best.da;
      j += best.db;
    } else {
      /* 找不到近距离对齐点时，用公共后缀兜底，避免把末尾相同部分全涂黄 */
      let suffix = 0;
      while (
        left.length - 1 - suffix >= i &&
        right.length - 1 - suffix >= j &&
        left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
      ) suffix++;

      const aEnd = left.length - suffix;
      const bEnd = right.length - suffix;
      pushDiffA(left.slice(i, aEnd));
      pushDiffB(right.slice(j, bEnd));

      for (let k = 0; k < suffix; k++) {
        pushSame(left[aEnd + k]);
      }
      i = left.length;
      j = right.length;
    }
  }

  return { leftHtml: outA.join(''), rightHtml: outB.join('') };
}
