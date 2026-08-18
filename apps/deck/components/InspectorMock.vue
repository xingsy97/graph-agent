<template>
  <div class="inspector-shell">
    <div class="graph-side">
      <div class="small-node done">Define contract</div>
      <div class="small-node active">Build backend</div>
      <div class="small-node waiting">Integration</div>
      <svg viewBox="0 0 570 400">
        <path d="M150 200 C210 200 210 200 270 200" />
        <path d="M420 200 C470 200 470 200 520 200" />
      </svg>
    </div>
    <div class="inspector">
      <small>RUNNING · BUILD</small>
      <h3>Build backend</h3>
      <p class="action">Implementing API routes against the completed contract</p>
      <label>INPUTS RECEIVED</label>
      <div class="input"><i>✓</i><span><b>Define contract</b><small>OpenAPI schema and validation rules</small></span></div>
      <label>DOWNSTREAM</label>
      <div class="input muted"><i>○</i><span><b>Integration</b><small>Waiting for backend and interface</small></span></div>
      <label>LATEST ACTIVITY</label>
      <p class="log">Created typed request handlers · 14:32:18</p>
    </div>
  </div>
</template>

<style scoped>
.inspector-shell {
  border: 1px solid #30343e;
  border-radius: 20px;
  display: grid;
  grid-template-columns: 1.35fr .8fr;
  height: 480px;
  margin-top: 28px;
  overflow: hidden;
}
.graph-side {
  background: radial-gradient(circle at 45% 50%, rgba(128,108,255,.12), transparent 260px), #0c0e13;
  position: relative;
}
.graph-side svg { height: 100%; inset: 0; position: absolute; width: 100%; }
.graph-side path { fill: none; stroke: #4b505d; stroke-width: 2; }
.small-node {
  align-items: center;
  background: #171a21;
  border: 1px solid #3b404c;
  border-radius: 13px;
  color: #f6f7fb;
  display: flex;
  font-size: 14px;
  height: 72px;
  justify-content: center;
  position: absolute;
  top: 164px;
  width: 145px;
  z-index: 1;
}
.small-node.done { left: 48px; }
.small-node.active { border-color: #806cff; box-shadow: 0 0 30px rgba(128,108,255,.24); left: 270px; }
.small-node.waiting { left: 520px; }
.inspector { background: #111319; border-left: 1px solid #30343e; padding: 28px; }
.inspector > small { color: #b5a9ff; font-size: 11px; letter-spacing: .1em; }
.inspector h3 { color: #f6f7fb; font-size: 24px; margin: 7px 0 8px; }
.action { color: #c2c6cf; font-size: 15px; line-height: 1.45; margin-bottom: 25px; }
.inspector label { color: #767d89; display: block; font-size: 10px; letter-spacing: .11em; margin: 18px 0 8px; }
.input { align-items: center; background: #171a21; border: 1px solid #30343e; border-radius: 11px; display: flex; gap: 12px; padding: 11px 13px; }
.input i { color: #65d99b; font-style: normal; }
.input span { display: flex; flex-direction: column; }
.input b { color: #f6f7fb; font-size: 13px; }
.input small { color: #858c99; font-size: 11px; margin-top: 2px; }
.input.muted i { color: #777e8b; }
.log { color: #a8aeb9; font: 12px/1.45 ui-monospace, monospace; }
</style>
