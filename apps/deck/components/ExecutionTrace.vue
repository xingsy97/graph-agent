<template>
  <div class="trace-shell">
    <div class="metrics">
      <div class="hero"><small>LESS ELAPSED TIME</small><strong>54%</strong><span>based on recorded task runtimes</span></div>
      <div><b>1h 43m 55s</b><span>run one by one</span></div>
      <div><b>47m 26s</b><span>actual parallel run</span></div>
      <div><b>8</b><span>tasks at peak concurrency</span></div>
    </div>
    <div class="trace">
      <div class="axis"><span>0:00</span><span>15:00</span><span>30:00</span><span>47:26</span></div>
      <div class="row"><label>Contracts</label><i class="bar contract" /></div>
      <div class="row"><label>Persistence</label><i class="bar backend" /></div>
      <div class="row"><label>Clients</label><i class="bar interface" /></div>
      <div class="row"><label>Verification</label><i class="bar integration" /></div>
      <div class="observed">37 / 37 tasks succeeded · 7 graph versions</div>
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
.contract { background: #5c6472; left: 0; width: 28%; }
.backend { background: #806cff; left: 17%; width: 49%; }
.interface { background: #aa9cff; left: 17%; width: 38%; }
.integration { background: #65d99b; left: 66%; width: 32%; }
.observed { border-top: 2px solid #65d99b; bottom: 20px; color: #65d99b; font-size: 10px; left: 164px; padding-top: 4px; position: absolute; right: 40px; }
</style>
