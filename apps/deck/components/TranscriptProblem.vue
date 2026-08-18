<template>
  <div class="problem">
    <div class="transcript">
      <span>Thinking...</span>
      <span>Working on your request...</span>
      <span>Still working...</span>
      <strong>Done.</strong>
    </div>
    <div class="questions">
      <div><b>01</b><span>What can run now?</span></div>
      <div><b>02</b><span>What is blocked — and why?</span></div>
      <div><b>03</b><span>Did parallelism actually save time?</span></div>
    </div>
  </div>
</template>

<style scoped>
.problem {
  display: grid;
  gap: 42px;
  grid-template-columns: .85fr 1.15fr;
  margin-top: 58px;
}
.transcript {
  background: #111319;
  border: 1px solid #30343e;
  border-radius: 18px;
  color: #777e8b;
  display: flex;
  flex-direction: column;
  font: 16px/1.7 ui-monospace, monospace;
  gap: 18px;
  padding: 32px;
}
.transcript strong { color: #f6f7fb; }
.questions { display: flex; flex-direction: column; gap: 16px; }
.questions div {
  align-items: center;
  background: rgba(255,255,255,.025);
  border: 1px solid #30343e;
  border-radius: 16px;
  display: flex;
  gap: 22px;
  padding: 22px 26px;
}
.questions b { color: #806cff; font: 14px ui-monospace, monospace; }
.questions span { color: #f6f7fb; font-size: 21px; }
</style>
