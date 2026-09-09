<script>
  import { onMount } from 'svelte'
  import { supabase, isSupabaseConfigured } from './lib/supabase.js'

  let connectionStatus = isSupabaseConfigured ? 'Checking connection…' : 'Not configured'
  let sessionEmail = null

  onMount(async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) throw error

      connectionStatus = 'Supabase configured'
      sessionEmail = data.session?.user?.email ?? null
    } catch (error) {
      connectionStatus = 'Configuration error'
      console.error('Supabase connection check failed:', error)
    }
  })
</script>

<svelte:head>
  <title>DataTracker</title>
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <div>
      <p class="eyebrow">Supabase + Svelte</p>
      <h1>DataTracker</h1>
    </div>
  </header>

  <main class="content">
    <section class="panel">
      <h2>Project ready</h2>
      <p>
        This is the base DataTracker application. No database tables or business rules
        have been assumed yet.
      </p>

      <div class="status-row">
        <span class:ready={isSupabaseConfigured} class="status-dot"></span>
        <div>
          <strong>{connectionStatus}</strong>
          {#if !isSupabaseConfigured}
            <p>Add your Supabase project URL and publishable key to a local <code>.env</code> file.</p>
          {:else if sessionEmail}
            <p>Signed in as {sessionEmail}</p>
          {:else}
            <p>No active user session.</p>
          {/if}
        </div>
      </div>
    </section>
  </main>
</div>
