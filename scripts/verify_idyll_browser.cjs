const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const chrome = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.STUDIO_URL || "http://127.0.0.1:8000";
const answers = path.join(__dirname, "..");
const root = path.resolve(process.argv[2] || path.join(answers, "../crowdsource-code-platform"));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "idyll-advanced-browser-"));
  const browser = spawn(chrome, ["--headless=new", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${directory}`, "--remote-debugging-port=0", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let log = "";
      const timeout = setTimeout(() => reject(new Error("Chrome did not start")), 15000);
      browser.stderr.on("data", data => {
        log += data;
        const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
      browser.on("error", reject);
    });
    socket = new WebSocket(endpoint);
    await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
    let nextId = 0;
    const pending = new Map();
    const contexts = [];
    const logs = [];
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        clearTimeout(request.timeout);
        message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
      } else if (message.method === "Runtime.consoleAPICalled") {
        logs.push(message.params.args.map(arg=>arg.description || arg.value).join(" "));
      } else if (message.method === "Runtime.executionContextCreated") {
        contexts.push({ ...message.params.context, session: message.sessionId });
      } else if (message.method === "Target.attachedToTarget") {
        send("Runtime.enable", {}, message.params.sessionId).catch(() => {});
      }
    });
    const { targetId } = await send("Target.createTarget", { url: `${base}/?preview=1&task=idyll-playground-v1` });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Runtime.enable", {}, sessionId);
    await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sessionId);
    const evaluate = async (expression, context) => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, ...(context ? { contextId: context.id } : {}) }, context?.session || sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ": " + result.exceptionDetails.exception?.description);
      return result.result.value;
    };
    const waitFor = async (expression, message, context) => {
      const end = Date.now() + 20000;
      while (Date.now() < end) {
        try { if (await evaluate(expression, context)) return; } catch (_) {}
        await delay(75);
      }
      throw new Error(message);
    };
    await waitFor("!!document.querySelector('#sourceEditor')", "Host page must load");
    await send('Emulation.setDeviceMetricsOverride', {width:1600,height:1000,deviceScaleFactor:1,mobile:false}, sessionId);
    await evaluate("window.previewMessages=[]; window.addEventListener('message', e=>window.previewMessages.push(e.data)); const frame=document.createElement('iframe'); frame.id='advanced-frame'; frame.style='width:1000px;height:850px'; frame.sandbox='allow-scripts'; frame.src='/idyll-preview.html'; document.body.append(frame)");
    let preview;
    for (let attempt=0;attempt<100 && !preview;attempt++) {
      for(const context of contexts.filter(context=>context.auxData?.isDefault)) {
        try {if(await evaluate("location.pathname === '/idyll-preview.html'",context)) preview=context;}catch(_){}
      }
      if(!preview) await delay(75);
    }
    assert.ok(preview,'Sandboxed preview context must exist');
    const data = await (await fetch(`${base}/sales-data.json`)).json();
    const answer = level => fs.readFileSync(path.join(answers, 'idyll', `task${level}_answer.idyll`), 'utf8');
    const render = async source => {
      const compiled = spawnSync('node', [path.join(root, 'scripts/idyll_compile.cjs')], {input:JSON.stringify({source}), encoding:'utf8', timeout:25000});
      assert.equal(compiled.status, 0, compiled.stderr);
      const result = JSON.parse(compiled.stdout);
      assert.equal(result.ok, true, JSON.stringify(result.error));
      await evaluate(`document.querySelector('#advanced-frame').contentWindow.postMessage({type:'idyll.render',ast:${JSON.stringify(result.ast)},datasets:{sales:${JSON.stringify(data)}}},'*')`);
      await delay(350);
      assert.equal(await evaluate("document.querySelector('#preview-error').hidden", preview), true, await evaluate("document.querySelector('#preview-error').textContent", preview));
    };
    const setControl = async (selector, value) => {
      await evaluate(`(()=>{const control=document.querySelector(${JSON.stringify(selector)});const prototype=control.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(control,${JSON.stringify(String(value))});control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));})()`, preview);
      await delay(100);
      assert.equal(await evaluate("document.querySelector('#preview-error').hidden", preview), true);
    };
    const chartRows = attribute => evaluate(`JSON.parse(document.querySelector('[${attribute}]').getAttribute('${attribute}'))`, preview);
    await render(answer(1));
    for (const quantity of [0, 4, 10]) {
      await setControl('input[type=range]', quantity);
      const visible = await evaluate("document.querySelector('#article').innerText", preview);
      assert.match(visible, new RegExp(`Quantity: ${quantity}\\.00`));
      assert.match(visible, new RegExp(`Total: ${quantity * 5}\\.00`));
    }
    console.log('PASS idyll/task1_answer.idyll: live quantity and total');

    await render(answer(2));
    let combinations = 0;
    for (const category of ['All', 'Books', 'Games', 'Music']) {
      await setControl('select', category);
      for (const threshold of [0, 120, 200, 500]) {
        await setControl('input[type=range]', threshold);
        const expected = data.filter(row => (category === 'All' || row.category === category) && row.sales >= threshold);
        assert.deepEqual(await chartRows('data-chart-data'), expected);
        assert.deepEqual(await evaluate("[...document.querySelectorAll('tbody tr')].map(row=>JSON.parse(row.dataset.record))", preview), expected);
        const total = expected.reduce((sum, row) => sum + row.sales, 0);
        assert.equal(Number(await evaluate("document.querySelectorAll('#article .idyll-display')[0].textContent", preview)), expected.length);
        assert.equal(Number(await evaluate("document.querySelectorAll('#article .idyll-display')[1].textContent", preview)), total);
        const average = await evaluate("document.querySelectorAll('#article .idyll-display')[2].textContent", preview);
        if (expected.length) assert.ok(Math.abs(Number(average) - total / expected.length) < 0.011);
        else assert.equal(average, '—');
        assert.equal(await evaluate("document.querySelector('#article').innerText.includes('No matching records.')", preview), !expected.length);
        combinations++;
      }
    }
    console.log(`PASS idyll/task2_answer.idyll: ${combinations} linked-view, summary and empty-result combinations`);

    await render(answer(3));
    const scrollToStep = async index => {
      await evaluate(`(()=>{const step=document.querySelector('[data-story-step="${index}"]');window.scrollTo(0,window.scrollY+step.getBoundingClientRect().top-window.innerHeight*0.3);})()`, preview);
      await waitFor(`document.querySelector('[data-active-step]').dataset.activeStep==='${index}'`, 'Scroll must update the bound stage', preview);
    };
    await scrollToStep(0);
    assert.deepEqual(await chartRows('data-chart-data'), data);
    await scrollToStep(1);
    await setControl('select', 'Games');
    await setControl('input[type=range]', 150);
    assert.equal(await evaluate("document.querySelector('[data-chart-focus]').dataset.chartFocus", preview), 'Games');
    await scrollToStep(2);
    const selected = data.filter(row=>row.category==='Games');
    assert.deepEqual(await chartRows('data-chart-data'), selected);
    const expectedReference = [...new Set(data.map(row=>row.month))].map(month=>({month,sales:data.filter(row=>row.month===month).reduce((sum,row)=>sum+row.sales,0)/3}));
    assert.deepEqual(await chartRows('data-chart-reference'), expectedReference);
    const pinBefore = await evaluate("document.querySelector('.idyll-pinned').getBoundingClientRect().top", preview);
    await evaluate("window.scrollBy(0,100)", preview);
    await delay(100);
    const pinAfter = await evaluate("document.querySelector('.idyll-pinned').getBoundingClientRect().top", preview);
    assert.ok(Math.abs(pinBefore - pinAfter) < 2, 'Pinned chart must stay visible while scrolling');
    await scrollToStep(3);
    assert.deepEqual(await chartRows('data-chart-highlight'), selected.filter(row=>row.sales>150));
    assert.equal(await evaluate("document.querySelector('.idyll-pinned .idyll-display').textContent", preview), 'Threshold');
    await setControl('input[type=range]', 190);
    assert.deepEqual(await chartRows('data-chart-highlight'), []);
    await scrollToStep(2);
    await scrollToStep(1);
    assert.equal(await evaluate("document.querySelector('select').value", preview), 'Games');
    assert.equal(await evaluate("document.querySelector('input[type=range]').value", preview), '190');
    assert.equal(await evaluate("document.querySelector('[data-chart-focus]').dataset.chartFocus", preview), 'Games');
    await scrollToStep(0);
    assert.deepEqual(await chartRows('data-chart-data'), data);
    assert.equal(await evaluate("document.querySelector('#preview-error').hidden", preview), true);
    assert.equal(await evaluate("fetch('/api/health').then(()=>false).catch(()=>true)", preview), true);
    console.log('PASS idyll/task3_answer.idyll: forward/reverse scroll, live focus, monthly reference means, strict highlights, pin geometry and persistent controls');
    const commit = spawnSync('git', ['-C',root,'rev-parse','HEAD'], {encoding:'utf8'}).stdout.trim();
    fs.writeFileSync(path.join(answers, 'browser-validation.json'), JSON.stringify({verified_at_utc:new Date().toISOString(), platform_commit:commit, passed:true, files:[1,2,3].map(level=>{const file=`idyll/task${level}_answer.idyll`;return {file,sha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(answers,file))).digest('hex')};}), explorer_control_combinations:combinations, story_stages:[0,1,2,3,2,1,0], checks:['calculator reactive output','linked table and chart','summary values','empty results','scroll stage mapping','monthly reference averages','strict threshold highlights','pinned geometry','control persistence','sandbox networking blocked']}, null, 2) + '\n');
  } finally {
    socket?.close();
    browser.kill();
    await delay(300);
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
