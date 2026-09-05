<script setup lang="ts">
import { ref } from 'vue'
import TabulatorBudgetTable from './components/TabulatorBudgetTable.vue'

const scenarioCount = ref(4)

function formatScenarioCount(count: number) {
  return String(count).padStart(2, '0')
}
</script>

<template>
  <main class="prototype-app">
    <section class="variant-page variant-page--report">
      <div class="report-layout">
        <aside class="report-sidebar">
          <div class="report-side-top">
            <span class="side-logo">LB</span>
            <span class="side-version">P-02</span>
          </div>
          <div class="report-side-title">
            <span>LINK BUDGET</span>
            <strong>评估报告</strong>
          </div>
          <nav class="report-nav" aria-label="报告章节">
            <a class="report-nav-item report-nav-item--active" href="#matrix"><span>01</span> 参数矩阵</a>
            <a class="report-nav-item" href="#environment"><span>02</span> 环境假设</a>
            <a class="report-nav-item" href="#notes"><span>03</span> 备注说明</a>
          </nav>
          <div class="report-sidebar-foot">
            <span class="side-foot-line" />
            <span>静态编辑原型</span>
            <span>2026 / 09</span>
          </div>
        </aside>

        <div class="report-content">
          <header class="report-header">
            <div>
              <p class="eyebrow">SCENARIO REVIEW / 02</p>
              <h1>链路预算参数表</h1>
              <p class="report-intro">双击编辑场景名或场景值，或与 Excel 互相复制粘贴参数矩阵。</p>
            </div>
            <div class="report-header-meta">
              <span class="meta-label">原型状态</span>
              <strong>FSPL</strong>
              <span>自由空间覆盖计算</span>
            </div>
          </header>

          <div class="report-summary-row">
            <div class="report-summary-label">本页范围</div>
            <div class="report-summary-value"><strong>{{ formatScenarioCount(scenarioCount) }}</strong><span>场景</span></div>
            <div class="report-summary-value"><strong>10</strong><span>参数项</span></div>
            <div class="report-summary-value"><strong>dB / dBm</strong><span>主要单位</span></div>
            <div class="report-summary-caption">结构固定，先观察参数编辑和 Excel 表格交换体验。</div>
          </div>

          <section id="matrix" class="report-table-wrap">
            <div class="report-table-head">
              <div>
                <span class="panel-kicker">01 / INPUT MAP</span>
                <h2>场景参数</h2>
              </div>
              <span class="report-current">场景矩阵 · 自动计算</span>
            </div>
            <TabulatorBudgetTable @scenario-count-change="scenarioCount = $event" />
          </section>
        </div>
      </div>
    </section>
  </main>
</template>
