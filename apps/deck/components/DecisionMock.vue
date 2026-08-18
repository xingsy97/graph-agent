<template>
  <div class="decision-shell">
    <div class="continuing">
      <small>INDEPENDENT WORK CONTINUES</small>
      <div><i class="live" /><span><b>Documentation</b><small>Writing migration guide</small></span></div>
      <div><i class="live" /><span><b>Accessibility review</b><small>Checking interaction states</small></span></div>
      <div><i /><span><b>Release</b><small>Waiting for your decision</small></span></div>
    </div>
    <div class="decision">
      <small>DECISION REQUIRED · L3</small>
      <h3>How should the completed work be handed off?</h3>
      <p>Publishing affects an external system and cannot be auto-approved.</p>
      <label>RECOMMENDED</label>
      <div class="recommendation"><b>Keep as reviewed draft</b><span>Preserves the result without an irreversible action.</span></div>
      <button>Submit decision</button>
    </div>
  </div>
</template>

<style scoped>
.decision-shell { display: grid; gap: 26px; grid-template-columns: .86fr 1.14fr; margin-top: 42px; }
.continuing, .decision { background: #111319; border: 1px solid #30343e; border-radius: 19px; min-height: 430px; padding: 30px; }
.continuing > small, .decision > small { color: #8a919e; font-size: 11px; letter-spacing: .1em; }
.decision > small { color: #f5bd63; }
.continuing > div { align-items: center; background: #171a21; border: 1px solid #30343e; border-radius: 13px; display: flex; gap: 14px; margin-top: 18px; padding: 17px; }
.continuing i { background: #f5bd63; border-radius: 50%; height: 9px; width: 9px; }
.continuing i.live { animation: live 1.5s infinite; background: #806cff; box-shadow: 0 0 0 5px rgba(128,108,255,.13); }
.continuing span, .recommendation { display: flex; flex-direction: column; }
.continuing b { color: #f6f7fb; font-size: 14px; }
.continuing span small { color: #8c939f; font-size: 12px; margin-top: 3px; }
.decision h3 { color: #f6f7fb; font-size: 26px; line-height: 1.25; margin: 12px 0; }
.decision p { color: #9ba1ad; font-size: 14px; line-height: 1.5; }
.decision label { color: #797f8b; display: block; font-size: 10px; letter-spacing: .1em; margin: 25px 0 8px; }
.recommendation { background: rgba(128,108,255,.1); border: 1px solid rgba(128,108,255,.35); border-radius: 13px; padding: 16px; }
.recommendation b { color: #f6f7fb; font-size: 15px; }
.recommendation span { color: #a9a2d7; font-size: 12px; margin-top: 5px; }
button { background: #806cff; border: 0; border-radius: 10px; color: white; font-size: 14px; margin-top: 20px; padding: 13px; width: 100%; }
@keyframes live { 50% { opacity: .55; } }
</style>
