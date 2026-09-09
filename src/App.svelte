<script>
  import { onMount } from 'svelte'
  import { supabase, isSupabaseConfigured } from './lib/supabase.js'

  let loading = true
  let session = null
  let employee = null
  let authError = ''
  let appError = ''
  let notice = ''
  let email = ''
  let password = ''
  let signingIn = false

  let view = 'jobs'
  let jobs = []
  let allPours = []
  let selectedJob = null
  let pours = []
  let loadingJobs = false
  let loadingPours = false
  let loadingJob = false
  let creatingJob = false
  let creatingPour = false
  let deletingJobId = null
  let deletingPourId = null

  let showPourCreate = false
  let pourCreateMode = ''
  let jobSeqInput = ''
  let creatingPourFromList = false
  let pourCreateError = ''

  const employeeName = (record) => {
    if (!record) return 'Unknown employee'
    return [record.nameFirst, record.nameLast].filter(Boolean).join(' ') || 'Unknown employee'
  }

  const formatDateTime = (value) => {
    if (!value) return ''
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value))
  }

  const getJob = (jobId) => jobs.find((job) => job.id === jobId)

  onMount(async () => {
    if (!supabase) {
      loading = false
      return
    }

    const { data, error } = await supabase.auth.getSession()
    if (error) authError = error.message
    session = data?.session ?? null

    if (session) await bootstrapApp()
    else loading = false

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      session = nextSession
      if (nextSession) {
        await bootstrapApp()
      } else {
        employee = null
        jobs = []
        allPours = []
        selectedJob = null
        pours = []
        view = 'jobs'
        loading = false
      }
    })

    return () => listener.subscription.unsubscribe()
  })

  async function bootstrapApp() {
    loading = true
    appError = ''
    await loadEmployee()
    if (employee) await Promise.all([loadJobs(), loadAllPours()])
    loading = false
  }

  async function loadEmployee() {
    employee = null
    const { data, error } = await supabase
      .from('Employees')
      .select('id, nameFirst, nameLast, id_User')
      .eq('id_User', session.user.id)
      .maybeSingle()

    if (error) {
      appError = error.message
      return
    }

    if (!data) {
      appError = 'Your login is valid, but no matching Employees record exists for this user.'
      return
    }

    employee = data
  }

  async function signIn(event) {
    event.preventDefault()
    authError = ''
    signingIn = true
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) authError = error.message
    signingIn = false
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function loadJobs() {
    loadingJobs = true
    appError = ''

    const { data, error } = await supabase
      .from('Jobs')
      .select('id, seq, created_at, id_Employee, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
      .order('seq', { ascending: false })

    if (error) appError = error.message
    else jobs = data ?? []
    loadingJobs = false
  }

  async function loadAllPours() {
    loadingPours = true
    appError = ''

    const { data, error } = await supabase
      .from('Pours')
      .select('id, id_Job, stageNum, created_at, id_Employee, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
      .order('created_at', { ascending: false })

    if (error) appError = error.message
    else allPours = data ?? []
    loadingPours = false
  }

  function navigate(target) {
    view = target
    selectedJob = null
    pours = []
    appError = ''
    notice = ''
    if (target === 'jobs') loadJobs()
    if (target === 'pours') Promise.all([loadJobs(), loadAllPours()])
  }

  async function createJob() {
    creatingJob = true
    appError = ''
    notice = ''

    const { data, error } = await supabase
      .from('Jobs')
      .insert({})
      .select('id, seq, created_at, id_Employee, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
      .single()

    if (error) {
      appError = error.message
    } else {
      jobs = [data, ...jobs]
      notice = `Job ${data.seq} created.`
      await openJob(data.id)
    }

    creatingJob = false
  }

  async function openJob(jobId) {
    view = 'job'
    loadingJob = true
    appError = ''
    notice = ''

    const [{ data: job, error: jobError }, { data: pourRows, error: poursError }] = await Promise.all([
      supabase
        .from('Jobs')
        .select('id, seq, created_at, id_Employee, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
        .eq('id', jobId)
        .single(),
      supabase
        .from('Pours')
        .select('id, id_Job, stageNum, created_at, id_Employee, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
        .eq('id_Job', jobId)
        .order('stageNum', { ascending: true })
    ])

    if (jobError) appError = jobError.message
    if (poursError) appError = poursError.message

    selectedJob = job ?? null
    pours = pourRows ?? []
    loadingJob = false
  }

  function backToJobs() {
    navigate('jobs')
  }

  async function createPour() {
    if (!selectedJob) return

    creatingPour = true
    appError = ''
    notice = ''

    const { data, error } = await supabase
      .from('Pours')
      .insert({ id_Job: selectedJob.id })
      .select('id, id_Job, stageNum, created_at, id_Employee, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
      .single()

    if (error) {
      appError = error.message
    } else {
      pours = [...pours, data].sort((a, b) => a.stageNum - b.stageNum)
      allPours = [data, ...allPours]
      notice = `Stage ${data.stageNum} added.`
    }

    creatingPour = false
  }

  function openPourCreate() {
    showPourCreate = true
    pourCreateMode = ''
    jobSeqInput = ''
    pourCreateError = ''
  }

  function closePourCreate() {
    if (creatingPourFromList) return
    showPourCreate = false
    pourCreateMode = ''
    jobSeqInput = ''
    pourCreateError = ''
  }

  async function createPourFromList() {
    if (!pourCreateMode) return

    creatingPourFromList = true
    pourCreateError = ''
    appError = ''
    notice = ''

    if (pourCreateMode === 'new') {
      const { data: newJob, error: jobError } = await supabase
        .from('Jobs')
        .insert({})
        .select('id, seq, created_at, id_Employee, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
        .single()

      if (jobError) {
        pourCreateError = jobError.message
        creatingPourFromList = false
        return
      }

      const { data: newPour, error: pourError } = await supabase
        .from('Pours')
        .insert({ id_Job: newJob.id })
        .select('id, id_Job, stageNum, created_at, id_Employee, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
        .single()

      if (pourError) {
        await supabase.from('Jobs').delete().eq('id', newJob.id)
        pourCreateError = `The Job was created, but the Pour could not be created: ${pourError.message}`
        creatingPourFromList = false
        return
      }

      jobs = [newJob, ...jobs]
      allPours = [newPour, ...allPours]
      showPourCreate = false
      pourCreateMode = ''
      notice = `Job ${newJob.seq} created with Stage ${newPour.stageNum}.`
      creatingPourFromList = false
      return
    }

    const seq = Number(jobSeqInput)
    if (!Number.isInteger(seq) || seq < 1) {
      pourCreateError = 'Enter a valid Job sequence number.'
      creatingPourFromList = false
      return
    }

    const { data: matchedJob, error: matchError } = await supabase
      .from('Jobs')
      .select('id, seq, created_at, id_Employee, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
      .eq('seq', seq)
      .maybeSingle()

    if (matchError) {
      pourCreateError = matchError.message
      creatingPourFromList = false
      return
    }

    if (!matchedJob) {
      pourCreateError = `No Job found with sequence #${seq}.`
      creatingPourFromList = false
      return
    }

    const { data: newPour, error: pourError } = await supabase
      .from('Pours')
      .insert({ id_Job: matchedJob.id })
      .select('id, id_Job, stageNum, created_at, id_Employee, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
      .single()

    if (pourError) {
      pourCreateError = pourError.message
      creatingPourFromList = false
      return
    }

    if (!jobs.some((job) => job.id === matchedJob.id)) jobs = [matchedJob, ...jobs]
    allPours = [newPour, ...allPours]
    showPourCreate = false
    pourCreateMode = ''
    jobSeqInput = ''
    notice = `Stage ${newPour.stageNum} added to Job ${matchedJob.seq}.`
    creatingPourFromList = false
  }

  async function deletePour(pour) {
    if (!confirm(`Delete Stage ${pour.stageNum}? This cannot be undone.`)) return

    deletingPourId = pour.id
    appError = ''
    const { error } = await supabase.from('Pours').delete().eq('id', pour.id)

    if (error) appError = error.message
    else {
      pours = pours.filter((item) => item.id !== pour.id)
      allPours = allPours.filter((item) => item.id !== pour.id)
    }

    deletingPourId = null
  }

  async function deleteJob(job) {
    if (!confirm(`Delete Job ${job.seq} and all of its Pours? This cannot be undone.`)) return

    deletingJobId = job.id
    appError = ''
    const { error } = await supabase.from('Jobs').delete().eq('id', job.id)

    if (error) appError = error.message
    else {
      jobs = jobs.filter((item) => item.id !== job.id)
      allPours = allPours.filter((item) => item.id_Job !== job.id)
    }

    deletingJobId = null
  }
</script>

<svelte:head>
  <title>DataTracker</title>
  <meta name="description" content="DataTracker job and pour tracking" />
</svelte:head>

{#if !isSupabaseConfigured}
  <main class="setup-page">
    <section class="setup-card">
      <div class="brand-mark">DT</div>
      <p class="eyebrow">DataTracker</p>
      <h1>Supabase connection required</h1>
      <p>Add your DataTracker Supabase URL and publishable key to <code>.env</code>, then restart Vite.</p>
    </section>
  </main>
{:else if loading}
  <main class="loading-page">
    <div class="spinner"></div>
    <p>Loading DataTracker…</p>
  </main>
{:else if !session}
  <main class="auth-page">
    <section class="auth-card">
      <div class="brand-row">
        <div class="brand-mark">DT</div>
        <div>
          <p class="eyebrow">DataTracker</p>
          <h1>Sign in</h1>
        </div>
      </div>
      <p class="auth-copy">Use your DataTracker employee account to continue.</p>
      <form on:submit={signIn} class="auth-form">
        <label><span>Email</span><input bind:value={email} type="email" autocomplete="email" required placeholder="you@example.com" /></label>
        <label><span>Password</span><input bind:value={password} type="password" autocomplete="current-password" required placeholder="••••••••" /></label>
        {#if authError}<div class="alert error">{authError}</div>{/if}
        <button class="button primary wide" type="submit" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section>
  </main>
{:else}
  <div class="app-shell">
    <aside class="sidebar">
      <button class="sidebar-brand" on:click={() => navigate('jobs')} aria-label="Go to Jobs">
        <span class="brand-mark small">DT</span>
        <span><span class="eyebrow">DataTracker</span><strong>Operations</strong></span>
      </button>

      <nav class="side-nav" aria-label="Primary navigation">
        <button class:active={view === 'jobs' || view === 'job'} on:click={() => navigate('jobs')}>
          <span class="nav-icon">▣</span><span>Jobs</span>
        </button>
        <button class:active={view === 'pours'} on:click={() => navigate('pours')}>
          <span class="nav-icon">◫</span><span>Pours</span>
        </button>
      </nav>

      <div class="sidebar-user">
        {#if employee}<div class="sidebar-user-name">{employeeName(employee)}</div>{/if}
        <button class="button ghost wide" on:click={signOut}>Sign out</button>
      </div>
    </aside>

    <div class="app-main">
      <header class="mobile-topbar">
        <div class="mobile-brand"><span class="brand-mark small">DT</span><strong>DataTracker</strong></div>
        <button class="button ghost" on:click={signOut}>Sign out</button>
      </header>

      <nav class="mobile-nav" aria-label="Mobile navigation">
        <button class:active={view === 'jobs' || view === 'job'} on:click={() => navigate('jobs')}>Jobs</button>
        <button class:active={view === 'pours'} on:click={() => navigate('pours')}>Pours</button>
      </nav>

      <main class="content">
        {#if appError}<div class="alert error top-alert">{appError}</div>{/if}
        {#if notice}<div class="alert success top-alert">{notice}</div>{/if}

        {#if !employee}
          <section class="panel empty-state">
            <p class="eyebrow">Account setup</p>
            <h2>Employee profile required</h2>
            <p>Your Supabase Auth user needs a matching record in <code>Employees.id_User</code>.</p>
          </section>
        {:else if view === 'jobs'}
          <section class="page-heading">
            <div><p class="eyebrow">Jobs</p><h1>Jobs</h1><p>Track each job and its associated pour stages.</p></div>
            <button class="button primary" on:click={createJob} disabled={creatingJob}><span class="plus">+</span>{creatingJob ? 'Creating…' : 'New Job'}</button>
          </section>

          <section class="panel list-panel">
            <div class="panel-heading"><div><p class="eyebrow">Job register</p><h2>All jobs</h2></div><span class="count-badge">{jobs.length}</span></div>
            {#if loadingJobs}
              <div class="panel-loading">Loading jobs…</div>
            {:else if jobs.length === 0}
              <div class="empty-state compact"><h3>No jobs yet</h3><p>Create your first Job to start tracking Pours.</p><button class="button primary" on:click={createJob}>New Job</button></div>
            {:else}
              <div class="table-wrap">
                <table><thead><tr><th>Job</th><th class="actions-column">Actions</th></tr></thead><tbody>
                  {#each jobs as job}
                    <tr>
                      <td><button class="record-link" on:click={() => openJob(job.id)}>Job {job.seq}</button></td>
                      <td class="row-actions"><button class="button secondary small-button" on:click={() => openJob(job.id)}>Open</button><button class="icon-button danger" title="Delete job" aria-label={`Delete Job ${job.seq}`} disabled={deletingJobId === job.id} on:click={() => deleteJob(job)}>{deletingJobId === job.id ? '…' : '×'}</button></td>
                    </tr>
                  {/each}
                </tbody></table>
              </div>
            {/if}
          </section>
        {:else if view === 'pours'}
          <section class="page-heading">
            <div><p class="eyebrow">Pours</p><h1>Pours</h1><p>Open any Pour directly, grouped by its parent Job and stage number.</p></div>
            <button class="button primary" on:click={openPourCreate}><span class="plus">+</span>New Pour</button>
          </section>

          <section class="panel list-panel">
            <div class="panel-heading"><div><p class="eyebrow">Pour register</p><h2>All pours</h2></div><span class="count-badge">{allPours.length}</span></div>
            {#if loadingPours}
              <div class="panel-loading">Loading pours…</div>
            {:else if allPours.length === 0}
              <div class="empty-state compact"><h3>No Pours yet</h3><p>Create a new Pour here, or add another stage to an existing Job.</p><button class="button primary" on:click={openPourCreate}>New Pour</button></div>
            {:else}
              <div class="table-wrap">
                <table><thead><tr><th>Pour</th><th>Job</th><th class="actions-column">Actions</th></tr></thead><tbody>
                  {#each allPours as pour}
                    <tr>
                      <td><button class="record-link" on:click={() => openJob(pour.id_Job)}>Stage {pour.stageNum}</button></td>
                      <td class="muted-cell">{getJob(pour.id_Job) ? `Job ${getJob(pour.id_Job).seq}` : 'Unknown Job'}</td>
                      <td class="row-actions"><button class="button secondary small-button" on:click={() => openJob(pour.id_Job)}>Open</button><button class="icon-button danger" title="Delete pour" aria-label={`Delete Stage ${pour.stageNum}`} disabled={deletingPourId === pour.id} on:click={() => deletePour(pour)}>{deletingPourId === pour.id ? '…' : '×'}</button></td>
                    </tr>
                  {/each}
                </tbody></table>
              </div>
            {/if}
          </section>
        {:else if view === 'job'}
          <button class="back-button" on:click={backToJobs}>← Back to Jobs</button>
          {#if loadingJob}
            <section class="panel panel-loading">Loading job…</section>
          {:else if selectedJob}
            <section class="detail-heading"><div><p class="eyebrow">Job details</p><h1>Job {selectedJob.seq}</h1><p class="creator-line">Created {formatDateTime(selectedJob.created_at)}{#if selectedJob.creator} by {employeeName(selectedJob.creator)}{/if}</p></div></section>
            <section class="panel list-panel">
              <div class="panel-heading pours-heading"><div><p class="eyebrow">Pours</p><h2>Stages on this job</h2></div><div class="heading-actions"><span class="count-badge">{pours.length}</span><button class="button primary" on:click={createPour} disabled={creatingPour}><span class="plus">+</span>{creatingPour ? 'Adding…' : 'Add Pour'}</button></div></div>
              {#if pours.length === 0}
                <div class="empty-state compact"><h3>No Pours yet</h3><p>The first Pour added to this Job will automatically receive Stage 1.</p><button class="button primary" on:click={createPour}>Add Pour</button></div>
              {:else}
                <div class="table-wrap">
                  <table><thead><tr><th>Stage</th><th>Created</th><th>Created by</th><th class="actions-column">Actions</th></tr></thead><tbody>
                    {#each pours as pour}
                      <tr><td><strong>Stage {pour.stageNum}</strong></td><td class="muted-cell">{formatDateTime(pour.created_at)}</td><td class="muted-cell">{employeeName(pour.creator)}</td><td class="row-actions"><button class="icon-button danger" title="Delete pour" aria-label={`Delete Stage ${pour.stageNum}`} disabled={deletingPourId === pour.id} on:click={() => deletePour(pour)}>{deletingPourId === pour.id ? '…' : '×'}</button></td></tr>
                    {/each}
                  </tbody></table>
                </div>
              {/if}
            </section>
          {/if}
        {/if}
      </main>
    </div>

    {#if showPourCreate}
      <div class="modal-backdrop" role="presentation" on:click={closePourCreate}>
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-pour-title" on:click|stopPropagation>
          <div class="modal-heading">
            <div>
              <p class="eyebrow">Create Pour</p>
              <h2 id="new-pour-title">Is this a new Pour or an additional stage?</h2>
            </div>
            <button class="modal-close" aria-label="Close" on:click={closePourCreate} disabled={creatingPourFromList}>×</button>
          </div>

          {#if !pourCreateMode}
            <div class="choice-grid">
              <button class="choice-card" on:click={() => (pourCreateMode = 'new')}>
                <strong>New Pour</strong>
                <span>Create a new Job and automatically add Stage 1.</span>
              </button>
              <button class="choice-card" on:click={() => (pourCreateMode = 'stage')}>
                <strong>Additional Stage</strong>
                <span>Add the next stage to an existing Job.</span>
              </button>
            </div>
          {:else if pourCreateMode === 'new'}
            <div class="modal-body">
              <p>A new Job will be created first, then its first Pour will be created as Stage 1.</p>
              {#if pourCreateError}<div class="alert error">{pourCreateError}</div>{/if}
              <div class="modal-actions">
                <button class="button secondary" on:click={() => { pourCreateMode = ''; pourCreateError = '' }} disabled={creatingPourFromList}>Back</button>
                <button class="button primary" on:click={createPourFromList} disabled={creatingPourFromList}>{creatingPourFromList ? 'Creating…' : 'Create New Pour'}</button>
              </div>
            </div>
          {:else}
            <form class="modal-body" on:submit|preventDefault={createPourFromList}>
              <label class="field-label">
                <span>Job seq #</span>
                <input bind:value={jobSeqInput} type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 125" autofocus />
              </label>
              <p class="field-help">The Job is matched against <code>Jobs.seq</code>. The database will assign the next <code>stageNum</code>.</p>
              {#if pourCreateError}<div class="alert error">{pourCreateError}</div>{/if}
              <div class="modal-actions">
                <button type="button" class="button secondary" on:click={() => { pourCreateMode = ''; pourCreateError = ''; jobSeqInput = '' }} disabled={creatingPourFromList}>Back</button>
                <button type="submit" class="button primary" disabled={creatingPourFromList || !jobSeqInput}>{creatingPourFromList ? 'Adding…' : 'Add Stage'}</button>
              </div>
            </form>
          {/if}
        </section>
      </div>
    {/if}
  </div>
{/if}
