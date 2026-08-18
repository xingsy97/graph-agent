<script setup lang="ts">
defineProps<{ variant: "overview" | "handoff" | "rewrite" }>();
</script>

<template>
  <div class="graph-scene" :class="`is-${variant}`">
    <svg viewBox="0 0 1100 410" aria-hidden="true">
      <path class="edge base" d="M150 205 C220 205 220 96 300 96" />
      <path class="edge base" d="M150 205 C220 205 220 314 300 314" />
      <path class="edge base" d="M460 96 C550 96 550 205 640 205" />
      <path class="edge base" d="M460 314 C550 314 550 205 640 205" />
      <path class="edge base" d="M800 205 C880 205 880 205 950 205" />
      <path v-if="variant === 'handoff'" class="edge active top" d="M150 205 C220 205 220 96 300 96" />
      <path v-if="variant === 'handoff'" class="edge active bottom" d="M150 205 C220 205 220 314 300 314" />
    </svg>

    <template v-if="variant !== 'rewrite'">
      <div class="node root"><small>completed</small><strong>Define contract</strong><span>Shared API output</span></div>
      <div class="node branch branch-a"><small>running</small><strong>Build backend</strong><span>Consumes contract</span></div>
      <div class="node branch branch-b"><small>running</small><strong>Build interface</strong><span>Consumes contract</span></div>
      <div class="node merge"><small>queued</small><strong>Integration</strong><span>Waiting for both</span></div>
      <div class="node finish"><small>queued</small><strong>Verify release</strong><span>Final evidence</span></div>
    </template>

    <template v-else>
      <div class="rewrite-before">
        <small>Graph v1</small>
        <div class="node old"><span>replaced</span><strong>Build core system</strong></div>
      </div>
      <div class="rewrite-arrow">→</div>
      <div class="rewrite-after">
        <small>Graph v2</small>
        <div class="mini-node entry">Prepare</div>
        <div class="mini-node left">Persistence</div>
        <div class="mini-node right">API behavior</div>
        <div class="mini-node exit">Validate</div>
        <svg viewBox="0 0 480 300" aria-hidden="true">
          <path d="M92 150 C145 150 142 77 196 77" />
          <path d="M92 150 C145 150 142 223 196 223" />
          <path d="M306 77 C352 77 350 150 400 150" />
          <path d="M306 223 C352 223 350 150 400 150" />
        </svg>
      </div>
    </template>
  </div>
</template>

<style scoped>
.graph-scene {
  background:
    linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px),
    #0c0e13;
  background-size: 28px 28px;
  border: 1px solid #292d36;
  border-radius: 22px;
  height: 410px;
  margin-top: 30px;
  overflow: hidden;
  position: relative;
}

.graph-scene > svg {
  height: 100%;
  inset: 0;
  position: absolute;
  width: 100%;
}

.edge {
  fill: none;
  stroke-linecap: round;
  stroke-width: 2;
}

.edge.base {
  stroke: #383d48;
}

.edge.active {
  animation: pulse 2s infinite;
  stroke: #806cff;
  stroke-dasharray: 8 12;
  stroke-width: 4;
}

.edge.bottom {
  animation-delay: -.8s;
}

.node {
  background: linear-gradient(145deg, #191c24, #111319);
  border: 1px solid #3a3e49;
  border-radius: 14px;
  box-shadow: 0 12px 30px rgba(0,0,0,.32);
  display: flex;
  flex-direction: column;
  height: 104px;
  justify-content: center;
  padding: 0 16px;
  position: absolute;
  width: 174px;
}

.node small {
  color: #65d99b;
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.node strong {
  color: #f6f7fb;
  font-size: 16px;
  margin: 5px 0;
}

.node span {
  color: #8f96a3;
  font-size: 12px;
}

.root { left: calc(13.6% - 87px); top: 153px; }
.branch-a { left: calc(34.5% - 87px); top: 44px; }
.branch-b { left: calc(34.5% - 87px); top: 262px; }
.merge { left: calc(65.5% - 87px); top: 153px; }
.finish { left: calc(86.4% - 87px); top: 153px; }

.branch small {
  color: #b5a9ff;
}

.is-overview .branch-a,
.is-overview .branch-b {
  border-color: rgba(128,108,255,.65);
  box-shadow: 0 0 34px rgba(128,108,255,.18);
}

.rewrite-before,
.rewrite-after {
  position: absolute;
  top: 48px;
}

.rewrite-before {
  left: 78px;
  width: 330px;
}

.rewrite-after {
  right: 58px;
  width: 560px;
}

.rewrite-before > small,
.rewrite-after > small {
  color: #8f96a3;
  font-size: 13px;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.old {
  left: 54px;
  opacity: .55;
  position: relative;
  top: 92px;
  width: 220px;
}

.old span {
  color: #f5bd63;
  text-transform: uppercase;
}

.rewrite-arrow {
  color: #806cff;
  font-size: 48px;
  left: 45%;
  position: absolute;
  top: 178px;
}

.rewrite-after svg {
  height: 300px;
  left: 40px;
  position: absolute;
  top: 20px;
  width: 480px;
}

.rewrite-after svg path {
  fill: none;
  stroke: #5e6370;
  stroke-width: 2;
}

.mini-node {
  align-items: center;
  background: #181b23;
  border: 1px solid #4a4f5c;
  border-radius: 12px;
  color: #f6f7fb;
  display: flex;
  font-size: 14px;
  height: 54px;
  justify-content: center;
  position: absolute;
  width: 112px;
  z-index: 1;
}

.mini-node.entry { left: 38px; top: 142px; }
.mini-node.left { left: 196px; top: 69px; }
.mini-node.right { left: 196px; top: 215px; }
.mini-node.exit { border-color: #806cff; left: 400px; top: 142px; }

@keyframes pulse {
  to { stroke-dashoffset: -40; }
}
</style>
