<script>
  export let value = ''
  export let type = 'Company'
  export let phase = null
  export let disabled = false
  export let ariaLabel = ''
  export let placeholder = ''
  export let searchOptions
  export let onSelect

  let open = false
  let search = ''
  let options = []
  let loading = false
  let timer = null
  let requestId = 0
  let selectedLabel = ''
  let wrapper

  $: selectedOption = options.find((option) => option.id === value)
  $: if (selectedOption) selectedLabel = selectedOption.label

  async function runSearch(query = search) {
    if (disabled || !phase || !searchOptions) return
    const currentRequest = ++requestId
    loading = true

    try {
      const rows = await searchOptions(type, phase, query, value)
      if (currentRequest !== requestId) return
      options = rows ?? []

      const current = options.find((option) => option.id === value)
      if (current) selectedLabel = current.label
    } finally {
      if (currentRequest === requestId) loading = false
    }
  }

  function openSelector() {
    if (disabled) return
    open = true
    search = ''
    runSearch('')
  }

  function scheduleSearch() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => runSearch(search), 250)
  }

  function choose(option) {
    selectedLabel = option?.label ?? ''
    search = ''
    open = false
    onSelect?.(option?.id ?? '')
  }

  function clearSelection() {
    selectedLabel = ''
    search = ''
    open = false
    onSelect?.('')
  }

  function handleWindowClick(event) {
    if (open && wrapper && !wrapper.contains(event.target)) {
      open = false
      search = ''
    }
  }
</script>

<svelte:window on:click={handleWindowClick} />

<div class="searchable-role-select" bind:this={wrapper}>
  <button
    type="button"
    class="searchable-role-trigger"
    {disabled}
    aria-label={ariaLabel}
    aria-haspopup="listbox"
    aria-expanded={open}
    on:click|stopPropagation={openSelector}
  >
    <span class:placeholder={!selectedLabel}>
      {selectedLabel || placeholder || `Select ${type}`}
    </span>
    <span class="searchable-role-chevron">▾</span>
  </button>

  {#if open}
    <div class="searchable-role-menu" on:click|stopPropagation>
      <input
        class="searchable-role-search"
        type="search"
        placeholder={`Search ${type === 'Company' ? 'companies' : 'contacts'}…`}
        bind:value={search}
        aria-label={`Search ${type === 'Company' ? 'companies' : 'contacts'}`}
        on:input={scheduleSearch}
      />

      <div class="searchable-role-options" role="listbox">
        {#if value}
          <button type="button" class="searchable-role-option clear-option" on:click={clearSelection}>
            Clear selection
          </button>
        {/if}

        {#if loading}
          <div class="searchable-role-status">Loading…</div>
        {:else if options.length === 0}
          <div class="searchable-role-status">No matching records</div>
        {:else}
          {#each options as option (option.id)}
            <button
              type="button"
              class:selected={option.id === value}
              class="searchable-role-option"
              role="option"
              aria-selected={option.id === value}
              on:click={() => choose(option)}
            >
              {option.label}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
