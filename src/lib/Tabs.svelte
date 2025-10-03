<script lang="ts">
  interface Tab {
    label: string;
    component: any;
    props?: Record<string, any>;
  }
  export let tabs: Tab[] = [];
  let activeTab: number = 0;
</script>

<div class="tabs">
  <div class="tab-buttons">
    {#each tabs as tab, i}
      <button class:active={i === activeTab} on:click={() => activeTab = i}>
        {tab.label}
      </button>
    {/each}
  </div>
  <div class="tab-content">
    {#if tabs[activeTab]}
      <svelte:component this={tabs[activeTab].component} {...(tabs[activeTab].props || {})} />
    {/if}
  </div>
</div>

<style>
  .tabs {
    display: flex;
    flex-direction: column;
  }

  .tab-buttons {
    display: flex;
    border-bottom: 1px solid #ccc;
  }

  .tab-buttons button {
    background: none;
    border: none;
    padding: 10px 20px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: border-color 0.3s;
  }

  .tab-buttons button.active {
    border-bottom-color: #007bff;
    font-weight: bold;
  }

  .tab-buttons button:hover {
    background-color: #f0f0f0;
  }

  .tab-content {
    padding: 20px;
  }
</style>
