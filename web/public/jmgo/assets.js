// Bound cold-scene requests across renderers; failed images cannot leave loading stuck.
const pending = [];
let active = 0;
function schedule(job) {
  return new Promise((resolve, reject) => {
    pending.push({ job, resolve, reject });
    drain();
  });
}
function drain() {
  while (active < 3 && pending.length) {
    const { job, resolve, reject } = pending.shift();
    active++;
    Promise.resolve().then(job).then(resolve, reject).finally(() => { active--; drain(); });
  }
}

export function readAsset(url, kind = 'text') {
  return schedule(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw Object.assign(new Error(`资源加载失败：${response.status} ${url}`), { http: true });
        return await (kind === 'json' ? response.json() : kind === 'buffer' ? response.arrayBuffer() : response.text());
      } catch (error) {
        if (attempt === 1 || error.http) throw new Error(`资源加载失败：${url} (${error.message})`);
        await new Promise(resolve => setTimeout(resolve, 150));
      } finally { clearTimeout(deadline); }
    }
  });
}

export function loadAssetImage(url) {
  return schedule(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const image = new Image();
          const deadline = setTimeout(() => {
            image.onload = image.onerror = null; image.removeAttribute('src');
            reject(new Error(`贴图加载超时：${url}`));
          }, 7000);
          image.onload = () => { clearTimeout(deadline); resolve(image); };
          image.onerror = () => { clearTimeout(deadline); reject(new Error(`贴图加载失败：${url}`)); };
          image.src = url;
        });
      } catch (error) {
        if (attempt === 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
  });
}
