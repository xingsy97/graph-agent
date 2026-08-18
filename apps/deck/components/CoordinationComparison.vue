<template>
  <div class="comparison">
    <section>
      <small>ORDINARY SUBAGENTS</small>
      <h3>Concurrent, but loosely coordinated</h3>
      <div class="spawn"><span>Spawn A</span><span>Spawn B</span><span>Spawn C</span></div>
      <ul>
        <li>Dependencies live in the caller’s prompt</li>
        <li>Outputs must be manually reconciled</li>
        <li>A changed task often requires replanning</li>
      </ul>
    </section>
    <section class="graph">
      <small>GRAPH AGENT</small>
      <h3>Concurrency with executable dependencies</h3>
      <div class="flow">
        <span class="source">Contract</span>
        <span class="left">Backend</span>
        <span class="right">Interface</span>
        <span class="target">Integration</span>
        <svg viewBox="0 0 500 180">
          <path d="M100 90 C155 90 150 43 205 43" />
          <path d="M100 90 C155 90 150 137 205 137" />
          <path d="M295 43 C350 43 345 90 400 90" />
          <path d="M295 137 C350 137 345 90 400 90" />
        </svg>
      </div>
      <ul>
        <li>Outputs unlock and feed exact consumers</li>
        <li>Convergence waits for every required input</li>
        <li>Local rewrites preserve the rest of the plan</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.comparison { display: grid; gap: 24px; grid-template-columns: 1fr 1fr; margin-top: 34px; }
section { background: #111319; border: 1px solid #30343e; border-radius: 19px; min-height: 455px; padding: 28px; }
section.graph { border-color: rgba(128,108,255,.58); }
section > small { color: #7d8491; font-size: 11px; letter-spacing: .12em; }
.graph > small { color: #b5a9ff; }
h3 { color: #f6f7fb; font-size: 22px; margin: 8px 0 28px; }
.spawn { display: flex; gap: 10px; margin: 66px 0 70px; }
.spawn span { background: #1a1d25; border: 1px solid #343945; border-radius: 12px; color: #b0b6c1; flex: 1; padding: 19px 8px; text-align: center; }
ul { color: #9ba1ad; display: grid; font-size: 14px; gap: 11px; line-height: 1.35; padding-left: 20px; }
.flow { height: 180px; margin: 8px auto 28px; position: relative; width: 500px; }
.flow svg { height: 100%; inset: 0; position: absolute; width: 100%; }
.flow path { fill: none; stroke: #5d6270; stroke-width: 2; }
.flow span { align-items: center; background: #1a1d25; border: 1px solid #444a57; border-radius: 10px; color: #f6f7fb; display: flex; font-size: 12px; height: 45px; justify-content: center; position: absolute; width: 100px; z-index: 1; }
.flow .source { left: 50px; top: 68px; }
.flow .left { left: 200px; top: 20px; }
.flow .right { left: 200px; top: 115px; }
.flow .target { border-color: #806cff; left: 395px; top: 68px; }
</style>
