<template>
  <div class="trace-shell">
    <div class="metrics">
      <div class="hero"><small>PARALLEL TIME SAVED</small><strong>4m 04s</strong><span>measured from actual execution overlap</span></div>
      <div><b>9m 31s</b><span>serial-equivalent work</span></div>
      <div><b>5m 27s</b><span>active execution</span></div>
      <div><b>1.75×</b><span>effective speedup</span></div>
    </div>
    <div class="trace">
      <div class="axis"><span>0:00</span><span>2:00</span><span>4:00</span><span>6:00</span></div>
      <div class="row"><label>Contract</label><i class="bar contract" /><em class="handoff one">output handed off</em></div>
      <div class="row"><label>Backend</label><i class="bar backend" /></div>
      <div class="row"><label>Interface</label><i class="bar interface" /></div>
      <div class="row"><label>Integration</label><i class="bar integration" /><em class="handoff two">fan-in unlocked</em></div>
      <div class="critical">Critical path</div>
    </div>
  </div>
</template>

<style scoped>
.trace-shell { display: grid; gap: 28px; grid-template-columns: .68fr 1.32fr; margin-top: 34px; }
.metrics { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
.metrics > div { background: #111319; border: 1px solid #30343e; border-radius: 15px; display: flex; flex-direction: column; justify-content: center; min-height: 104px; padding: 17px; }
.metrics .hero { border-color: rgba(128,108,255,.65); grid-column: 1 / -1; min-height: 164px; }
.metrics small { color: #b5a9ff; font-size: 11px; letter-spacing: .11em; }
.metrics strong { color: #f6f7fb; font-size: 48px; letter-spacing: -.04em; margin: 4px 0; }
.metrics b { color: #f6f7fb; font-size: 23px; }
.metrics span { color: #8e95a1; font-size: 11px; margin-top: 3px; }
.trace { background: #111319; border: 1px solid #30343e; border-radius: 18px; padding: 25px 28px; position: relative; }
.axis { color: #6f7683; display: flex; font: 10px ui-monospace, monospace; justify-content: space-between; margin-left: 110px; }
.row { border-top: 1px solid #292d36; height: 76px; margin-left: 110px; position: relative; }
.row label { color: #abb1bc; font-size: 12px; left: -110px; position: absolute; top: 29px; }
.bar { border-radius: 7px; height: 22px; position: absolute; top: 27px; }
.contract { background: #5c6472; left: 0; width: 25%; }
.backend { background: #806cff; left: 25%; width: 47%; }
.interface { background: #aa9cff; left: 25%; width: 34%; }
.integration { background: #65d99b; left: 72%; width: 26%; }
.handoff { color: #8d94a0; font-size: 9px; font-style: normal; position: absolute; top: 53px; }
.handoff.one { left: 24%; }
.handoff.two { left: 70%; }
.critical { border-top: 2px solid #f5bd63; bottom: 20px; color: #f5bd63; font-size: 10px; left: 164px; padding-top: 4px; position: absolute; right: 40px; }
</style>
