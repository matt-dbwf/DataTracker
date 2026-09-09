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
  let allPourDates = []
  let selectedJob = null
  let selectedPour = null
  let pours = []
  let loadingJobs = false
  let loadingPours = false
  let loadingJob = false
  let loadingPour = false
  let creatingJob = false
  let creatingPour = false
  let deletingJobId = null
  let deletingPourId = null

  let phases = []
  let rolesCompanies = []
  let selectedRoleCompany = null
  let roleCompanyNameInput = ''
  let creatingRoleCompany = false
  let savingRoleCompany = false
  let loadingRoleCompany = false

  let rolesContacts = []
  let selectedRoleContact = null
  let roleContactNameInput = ''
  let creatingRoleContact = false
  let savingRoleContact = false
  let loadingRoleContact = false

  let companies = []
  let selectedCompany = null
  let contacts = []
  let companyNameInput = ''
  let companyRoleIds = []
  let contactFirstInput = ''
  let contactLastInput = ''
  let contactRoleIds = []
  let showContactCreateModal = false
  let creatingCompany = false
  let creatingContact = false
  let savingCompany = false
  let loadingCompany = false
  let selectedPhase = null
  let draggedPhaseId = null
  let phaseDropTargetId = null
  let phaseTypeRoleInput = ''
  let phaseRoleCompanyId = ''
  let phaseRoleContactId = ''
  let phaseDates = []
  let loadingPhases = false
  let loadingPhase = false
  let creatingPhase = false
  let updatingPhase = false
  let phaseNameInput = ''
  let phaseSortInput = 0
  let phaseDetailNameInput = ''
  let phaseDetailSortInput = 0

  let dates = []
  let dateHistoryPhaseId = null
  let loadingDates = false
  let creatingDate = false
  let dateStartInput = ''
  let dateFinishInput = ''
  let datePhaseInput = ''
  let deletingDateId = null
  let completingDateId = null
  let savingInlineDateKey = null
  let savingHistoryDateKey = null
  let savingAddressKey = null
  let savingPourListDateKey = null
  let completingPourListDateId = null
  let showHistoryDateCreate = false
  let historyDateStartInput = ''
  let creatingHistoryDate = false
  let historyDraft = []
  let historyOriginal = []
  let savingHistory = false
  let historyError = ''

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

  const formatDateOnly = (value) => {
    if (!value) return ''
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(`${value}T00:00:00Z`))
  }

  const pourPhaseDate = (pourId, phaseId) => {
    const related = allPourDates
      .filter((dateRecord) => dateRecord.id_Pour === pourId && dateRecord.id_Phase === phaseId)
      .sort((a, b) =>
        a.dateStart.localeCompare(b.dateStart) ||
        (a.dateFinish ?? '').localeCompare(b.dateFinish ?? '') ||
        a.id.localeCompare(b.id)
      )

    const firstIncomplete = related.find((dateRecord) => !dateRecord.flag_Complete)
    return firstIncomplete ?? related[related.length - 1] ?? null
  }

  const getJob = (jobId) => jobs.find((job) => job.id === jobId)
  const phaseName = (phaseId) => phases.find((phase) => phase.id === phaseId)?.name ?? 'Unknown phase'
  const phaseSort = (phaseId) => Number(phases.find((phase) => phase.id === phaseId)?.sort ?? Number.POSITIVE_INFINITY)
  const sortDatesByPhaseAndStart = (rows) => [...rows].sort((a, b) =>
    phaseSort(a.id_Phase) - phaseSort(b.id_Phase) ||
    a.dateStart.localeCompare(b.dateStart) ||
    a.id.localeCompare(b.id)
  )
  const daysBetweenDates = (start, finish) => {
    if (!start || !finish) return null
    const startMs = Date.parse(`${start}T00:00:00Z`)
    const finishMs = Date.parse(`${finish}T00:00:00Z`)
    return Math.round((finishMs - startMs) / 86400000)
  }
  const addDaysToDate = (dateValue, days) => {
    const date = new Date(`${dateValue}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
  }
  const pourIdentifier = (pour) => {
    const seq = getJob(pour.id_Job)?.seq
    return seq == null ? `Unknown Job-${pour.stageNum}` : `${seq}-${pour.stageNum}`
  }
  $: visibleDates = phases
    .map((phase) => {
      const relatedDates = sortDatesByPhaseAndStart(
        dates.filter((dateRecord) => dateRecord.id_Phase === phase.id)
      )

      const firstIncomplete = relatedDates.find((dateRecord) => !dateRecord.flag_Complete)
      if (firstIncomplete) return firstIncomplete

      return relatedDates.length > 0
        ? relatedDates[relatedDates.length - 1]
        : null
    })
    .filter(Boolean)

  $: pourPhaseRows = phases.map((phase) => ({
    phase,
    dateRecord: visibleDates.find((dateRecord) => dateRecord.id_Phase === phase.id) ?? null
  }))

  $: dateHistoryRecords = dateHistoryPhaseId
    ? [...historyDraft]
        .filter((dateRecord) =>
          !dateRecord._deleted &&
          dateRecord.id_Pour === selectedPour?.id &&
          dateRecord.id_Phase === dateHistoryPhaseId
        )
        .sort((a, b) =>
          Number(a.flag_Complete) - Number(b.flag_Complete) ||
          a.dateStart.localeCompare(b.dateStart) ||
          (a.dateFinish ?? '').localeCompare(b.dateFinish ?? '') ||
          a.id.localeCompare(b.id)
        )
    : []

  function openDateHistory(phaseId, pour = selectedPour) {
    if (pour) selectedPour = pour
    dateHistoryPhaseId = phaseId
    const sourceDates = pour
      ? allPourDates.filter((d) => d.id_Pour === pour.id && d.id_Phase === phaseId)
      : []
    historyOriginal = sourceDates.map((d) => ({ ...d }))
    historyDraft = historyOriginal.map((d) => ({ ...d }))
    showHistoryDateCreate = false
    historyDateStartInput = ''
    historyError = ''
  }

  function closeDateHistory() {
    if (savingHistory) return
    dateHistoryPhaseId = null
    historyDraft = []
    historyOriginal = []
    showHistoryDateCreate = false
    historyDateStartInput = ''
    historyError = ''
  }

  const companyRoleNames = (roleIds) =>
    (roleIds ?? [])
      .map((id) => rolesCompanies.find((role) => role.id === id)?.name)
      .filter(Boolean)
      .join(', ')

  const contactRoleNames = (roleIds) =>
    (roleIds ?? [])
      .map((id) => rolesContacts.find((role) => role.id === id)?.name)
      .filter(Boolean)
      .join(', ')

  function toggleCompanyRole(roleId) {
    companyRoleIds = companyRoleIds.includes(roleId)
      ? companyRoleIds.filter((id) => id !== roleId)
      : [...companyRoleIds, roleId]
  }

  function toggleContactRole(roleId) {
    contactRoleIds = contactRoleIds.includes(roleId)
      ? contactRoleIds.filter((id) => id !== roleId)
      : [...contactRoleIds, roleId]
  }

  async function loadCompanies() {
    const { data, error } = await supabase
      .from('Companies')
      .select('id, name, id_Roles')
      .order('name', { ascending: true })

    if (error) appError = error.message
    else companies = data ?? []
  }

  async function openCompany(companyId, historyMode = 'push') {
    writeAppLocation('company', companyId, historyMode)
    view = 'company'
    loadingCompany = true
    appError = ''
    selectedCompany = null
    contacts = []

    const [{ data: company, error: companyError }, { data: contactRows, error: contactsError }] = await Promise.all([
      supabase.from('Companies').select('id, name, id_Roles').eq('id', companyId).single(),
      supabase.from('Contacts').select('id, nameFirst, nameLast, id_Company, id_Roles').eq('id_Company', companyId).order('nameLast', { ascending: true }).order('nameFirst', { ascending: true })
    ])

    if (companyError) appError = companyError.message
    if (contactsError) appError = contactsError.message

    selectedCompany = company ?? null
    companyNameInput = company?.name ?? ''
    companyRoleIds = company?.id_Roles ?? []
    contacts = contactRows ?? []
    loadingCompany = false
  }

  async function createCompany() {
    creatingCompany = true
    appError = ''

    const { data, error } = await supabase
      .from('Companies')
      .insert({
        name: 'New Company',
        id_Roles: []
      })
      .select('id, name, id_Roles')
      .single()

    if (error) {
      appError = error.message
    } else {
      companies = [...companies, data].sort((a, b) => a.name.localeCompare(b.name))
      await openCompany(data.id)
    }

    creatingCompany = false
  }

  async function saveCompany() {
    if (!selectedCompany || !companyNameInput.trim()) return

    savingCompany = true
    appError = ''

    const { data, error } = await supabase
      .from('Companies')
      .update({
        name: companyNameInput.trim(),
        id_Roles: companyRoleIds
      })
      .eq('id', selectedCompany.id)
      .select('id, name, id_Roles')
      .single()

    if (error) {
      appError = error.message
    } else {
      selectedCompany = data
      companies = companies.map((company) => company.id === data.id ? data : company)
    }

    savingCompany = false
  }

  function openContactCreateModal() {
    contactFirstInput = ''
    contactLastInput = ''
    contactRoleIds = []
    appError = ''
    showContactCreateModal = true
  }

  function closeContactCreateModal() {
    if (creatingContact) return
    contactFirstInput = ''
    contactLastInput = ''
    contactRoleIds = []
    showContactCreateModal = false
  }

  async function createContact() {
    if (!selectedCompany || !contactFirstInput.trim() || !contactLastInput.trim()) return

    creatingContact = true
    appError = ''

    const { data, error } = await supabase
      .from('Contacts')
      .insert({
        nameFirst: contactFirstInput.trim(),
        nameLast: contactLastInput.trim(),
        id_Company: selectedCompany.id,
        id_Roles: contactRoleIds
      })
      .select('id, nameFirst, nameLast, id_Company, id_Roles')
      .single()

    if (error) {
      appError = error.message
    } else {
      contacts = [...contacts, data].sort((a, b) =>
        a.nameLast.localeCompare(b.nameLast) || a.nameFirst.localeCompare(b.nameFirst)
      )
      contactFirstInput = ''
      contactLastInput = ''
      contactRoleIds = []
      showContactCreateModal = false
    }

    creatingContact = false
  }

  function appLocation() {
    const params = new URLSearchParams(window.location.search)
    return {
      view: params.get('view') || 'jobs',
      id: params.get('id')
    }
  }

  function writeAppLocation(targetView, recordId = null, mode = 'push') {
    const url = new URL(window.location.href)
    if (targetView === 'jobs') {
      url.searchParams.delete('view')
      url.searchParams.delete('id')
    } else {
      url.searchParams.set('view', targetView)
      if (recordId) url.searchParams.set('id', recordId)
      else url.searchParams.delete('id')
    }

    const state = { view: targetView, id: recordId }
    if (mode === 'replace') window.history.replaceState(state, '', url)
    else if (mode === 'push') window.history.pushState(state, '', url)
  }

  async function restoreAppLocation() {
    if (!session || !employee) return

    const location = appLocation()

    if (location.view === 'job' && location.id) {
      await openJob(location.id, 'none')
      return
    }

    if (location.view === 'pour' && location.id) {
      await openPour(location.id, 'none')
      return
    }

    if (location.view === 'phase' && location.id) {
      await openPhase(location.id, 'none')
      return
    }

    if (location.view === 'company' && location.id) {
      await openCompany(location.id, 'none')
      return
    }

    if (location.view === 'role-company' && location.id) {
      await openRoleCompany(location.id, 'none')
      return
    }

    if (location.view === 'role-contact' && location.id) {
      await openRoleContact(location.id, 'none')
      return
    }

    if (['jobs', 'pours', 'phases', 'companies', 'roles-companies', 'roles-contacts'].includes(location.view)) {
      await navigate(location.view, 'none')
      return
    }

    await navigate('jobs', 'replace')
  }

  $: sortedAllPours = [...allPours].sort((a, b) => {
    const aSeq = Number(getJob(a.id_Job)?.seq ?? Number.POSITIVE_INFINITY)
    const bSeq = Number(getJob(b.id_Job)?.seq ?? Number.POSITIVE_INFINITY)
    return aSeq - bSeq || Number(a.stageNum) - Number(b.stageNum) || a.id.localeCompare(b.id)
  })

  onMount(() => {
    let authSubscription = null

    const handlePopState = () => {
      restoreAppLocation()
    }

    window.addEventListener('popstate', handlePopState)

    ;(async () => {
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
          phases = []
          companies = []
          selectedCompany = null
          contacts = []
          selectedPhase = null
          phaseDates = []
          dates = []
          selectedJob = null
          selectedPour = null
          pours = []
          view = 'jobs'
          loading = false
        }
      })

      authSubscription = listener.subscription
    })()

    return () => {
      window.removeEventListener('popstate', handlePopState)
      authSubscription?.unsubscribe()
    }
  })

  async function bootstrapApp() {
    loading = true
    appError = ''
    await loadEmployee()
    if (employee) {
      await Promise.all([loadJobs(), loadAllPours(), loadPhases(), loadCompanies(), loadRolesCompanies(), loadRolesContacts()])
      await restoreAppLocation()
    }
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


  async function loadRolesCompanies() {
    const { data, error } = await supabase
      .from('RolesCompanies')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) appError = error.message
    else rolesCompanies = data ?? []
  }

  async function loadRolesContacts() {
    const { data, error } = await supabase
      .from('RolesContacts')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) appError = error.message
    else rolesContacts = data ?? []
  }

  async function openRoleCompany(roleId, historyMode = 'push') {
    writeAppLocation('role-company', roleId, historyMode)
    view = 'role-company'
    loadingRoleCompany = true
    appError = ''
    selectedRoleCompany = null

    const { data, error } = await supabase
      .from('RolesCompanies')
      .select('id, name')
      .eq('id', roleId)
      .single()

    if (error) appError = error.message
    selectedRoleCompany = data ?? null
    roleCompanyNameInput = data?.name ?? ''
    loadingRoleCompany = false
  }

  async function openRoleContact(roleId, historyMode = 'push') {
    writeAppLocation('role-contact', roleId, historyMode)
    view = 'role-contact'
    loadingRoleContact = true
    appError = ''
    selectedRoleContact = null

    const { data, error } = await supabase
      .from('RolesContacts')
      .select('id, name')
      .eq('id', roleId)
      .single()

    if (error) appError = error.message
    selectedRoleContact = data ?? null
    roleContactNameInput = data?.name ?? ''
    loadingRoleContact = false
  }

  async function createRoleCompany() {
    creatingRoleCompany = true
    appError = ''

    const { data, error } = await supabase
      .from('RolesCompanies')
      .insert({ name: 'New Role' })
      .select('id, name')
      .single()

    if (error) {
      appError = error.message
    } else {
      rolesCompanies = [...rolesCompanies, data].sort((a, b) => a.name.localeCompare(b.name))
      await openRoleCompany(data.id)
    }

    creatingRoleCompany = false
  }

  async function createRoleContact() {
    creatingRoleContact = true
    appError = ''

    const { data, error } = await supabase
      .from('RolesContacts')
      .insert({ name: 'New Role' })
      .select('id, name')
      .single()

    if (error) {
      appError = error.message
    } else {
      rolesContacts = [...rolesContacts, data].sort((a, b) => a.name.localeCompare(b.name))
      await openRoleContact(data.id)
    }

    creatingRoleContact = false
  }

  async function saveRoleCompany() {
    if (!selectedRoleCompany || !roleCompanyNameInput.trim()) return

    savingRoleCompany = true
    appError = ''

    const { data, error } = await supabase
      .from('RolesCompanies')
      .update({ name: roleCompanyNameInput.trim() })
      .eq('id', selectedRoleCompany.id)
      .select('id, name')
      .single()

    if (error) {
      appError = error.message
    } else {
      selectedRoleCompany = data
      rolesCompanies = rolesCompanies
        .map((role) => role.id === data.id ? data : role)
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    savingRoleCompany = false
  }

  async function saveRoleContact() {
    if (!selectedRoleContact || !roleContactNameInput.trim()) return

    savingRoleContact = true
    appError = ''

    const { data, error } = await supabase
      .from('RolesContacts')
      .update({ name: roleContactNameInput.trim() })
      .eq('id', selectedRoleContact.id)
      .select('id, name')
      .single()

    if (error) {
      appError = error.message
    } else {
      selectedRoleContact = data
      rolesContacts = rolesContacts
        .map((role) => role.id === data.id ? data : role)
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    savingRoleContact = false
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function loadJobs() {
    loadingJobs = true
    appError = ''

    const { data, error } = await supabase
      .from('Jobs')
      .select('id, seq, created_at, id_Employee, address_LotNumber, address_StreetNumber, address_StreetName, address_Description, address_Suburb, address_Postcode, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
      .order('seq', { ascending: false })

    if (error) appError = error.message
    else jobs = data ?? []
    loadingJobs = false
  }

  async function loadAllPours() {
    loadingPours = true
    appError = ''

    const [{ data, error }, { data: dateData, error: dateError }] = await Promise.all([
      supabase
        .from('Pours')
        .select('id, id_Job, stageNum, created_at, id_Employee, address_Residence, status, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
        .order('created_at', { ascending: false }),
      supabase
        .from('Dates')
        .select('id, dateStart, dateFinish, id_Pour, id_Phase, flag_Complete')
        .order('dateStart', { ascending: true })
    ])

    if (error) appError = error.message
    else allPours = data ?? []

    if (dateError) appError = dateError.message
    else allPourDates = dateData ?? []

    loadingPours = false
  }


  async function loadPhases() {
    loadingPhases = true
    appError = ''

    const { data, error } = await supabase
      .from('Phases')
      .select('id, name, sort, typeRole, id_RoleCompany, id_RoleContact')
      .order('sort', { ascending: true })
      .order('name', { ascending: true })

    if (error) appError = error.message
    else phases = data ?? []
    loadingPhases = false
  }

  async function createPhase() {
    creatingPhase = true
    appError = ''

    const nextSort = phases.length > 0
      ? Math.max(...phases.map((phase) => Number(phase.sort) || 0)) + 1
      : 1

    const { data, error } = await supabase
      .from('Phases')
      .insert({
        name: 'New Phase',
        sort: nextSort
      })
      .select('id, name, sort, typeRole, id_RoleCompany, id_RoleContact')
      .single()

    if (error) {
      appError = error.message
    } else {
      phases = [...phases, data].sort(
        (a, b) => Number(a.sort) - Number(b.sort) || a.name.localeCompare(b.name)
      )
      await openPhase(data.id)
    }

    creatingPhase = false
  }

  function startPhaseDrag(phaseId) {
    draggedPhaseId = phaseId
    phaseDropTargetId = null
  }

  function overPhaseDrag(phaseId) {
    if (!draggedPhaseId || draggedPhaseId === phaseId) return
    phaseDropTargetId = phaseId
  }

  function endPhaseDrag() {
    draggedPhaseId = null
    phaseDropTargetId = null
  }

  async function dropPhaseOn(targetPhaseId) {
    if (!draggedPhaseId || draggedPhaseId === targetPhaseId) {
      endPhaseDrag()
      return
    }

    const ordered = [...phases].sort(
      (a, b) => Number(a.sort) - Number(b.sort) || a.name.localeCompare(b.name)
    )

    const fromIndex = ordered.findIndex((phase) => phase.id === draggedPhaseId)
    const toIndex = ordered.findIndex((phase) => phase.id === targetPhaseId)

    if (fromIndex < 0 || toIndex < 0) {
      endPhaseDrag()
      return
    }

    const reordered = [...ordered]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    const updatedPhases = reordered.map((phase, index) => ({
      ...phase,
      sort: index + 1
    }))

    phases = updatedPhases
    appError = ''

    const results = await Promise.all(
      updatedPhases.map((phase) =>
        supabase
          .from('Phases')
          .update({ sort: phase.sort })
          .eq('id', phase.id)
      )
    )

    const failed = results.find((result) => result.error)
    if (failed) {
      appError = failed.error.message
      await loadPhases()
    }

    endPhaseDrag()
  }

  async function openPhase(phaseId, historyMode = 'push') {
    writeAppLocation('phase', phaseId, historyMode)
    view = 'phase'
    loadingPhase = true
    appError = ''
    notice = ''
    selectedPhase = null
    selectedCompany = null
    contacts = []
    phaseDates = []

    const [{ data: phase, error: phaseError }, { data: dateRows, error: datesError }] = await Promise.all([
      supabase.from('Phases').select('id, name, sort, typeRole, id_RoleCompany, id_RoleContact').eq('id', phaseId).single(),
      supabase.from('Dates').select('id, dateStart, dateFinish, id_Pour, id_Phase, flag_Complete').eq('id_Phase', phaseId).order('dateStart', { ascending: true })
    ])

    if (phaseError) appError = phaseError.message
    if (datesError) appError = datesError.message

    selectedPhase = phase ?? null
    phaseDetailNameInput = phase?.name ?? ''
    phaseDetailSortInput = phase?.sort ?? 0
    phaseTypeRoleInput = phase?.typeRole ?? ''
    phaseRoleCompanyId = phase?.id_RoleCompany ?? ''
    phaseRoleContactId = phase?.id_RoleContact ?? ''
    phaseDates = dateRows ?? []
    loadingPhase = false
  }

  async function updatePhaseSort(event) {
    if (event) event.preventDefault()
    if (!selectedPhase) return

    const sort = Number(phaseDetailSortInput)
    if (!Number.isInteger(sort)) {
      appError = 'Sort must be a whole number.'
      return
    }

    updatingPhase = true
    appError = ''
    notice = ''

    const { data, error } = await supabase
      .from('Phases')
      .update({
        name: phaseDetailNameInput.trim(),
        sort,
        typeRole: phaseTypeRoleInput.trim() || null,
        id_RoleCompany: phaseTypeRoleInput === 'Company' ? (phaseRoleCompanyId || null) : null,
        id_RoleContact: phaseTypeRoleInput === 'Contact' ? (phaseRoleContactId || null) : null
      })
      .eq('id', selectedPhase.id)
      .select('id, name, sort, typeRole, id_RoleCompany, id_RoleContact')
      .single()

    if (error) {
      appError = error.message
    } else {
      selectedPhase = data
      phaseDetailNameInput = data.name
      phases = phases
        .map((phase) => phase.id === data.id ? data : phase)
        .sort((a, b) => Number(a.sort) - Number(b.sort) || a.name.localeCompare(b.name))
      notice = `Phase ${data.name} updated.`
    }

    updatingPhase = false
  }

  async function setPourListDateComplete(dateRecord, flagComplete) {
    if (!dateRecord) return

    completingPourListDateId = dateRecord.id
    appError = ''

    const { data, error } = await supabase
      .from('Dates')
      .update({ flag_Complete: flagComplete })
      .eq('id', dateRecord.id)
      .select('id, dateStart, dateFinish, id_Pour, id_Phase, flag_Complete')
      .single()

    if (error) {
      appError = error.message
    } else {
      allPourDates = allPourDates.map((item) => item.id === data.id ? data : item)
      if (selectedPour?.id === data.id_Pour) {
        dates = sortDatesByPhaseAndStart(
          dates.map((item) => item.id === data.id ? data : item)
        )
      }
    }

    completingPourListDateId = null
  }

  async function savePourListDate(pour, phase, field, value, inputElement) {
    const existing = pourPhaseDate(pour.id, phase.id)
    const key = `${pour.id}:${phase.id}:${field}`
    savingPourListDateKey = key
    appError = ''

    if (existing?.flag_Complete) {
      if (inputElement) inputElement.value = existing[field] || ''
      savingPourListDateKey = null
      return
    }

    if (field === 'dateStart' && !value) {
      appError = 'Start date cannot be blank.'
      if (inputElement) inputElement.value = existing?.dateStart || ''
      savingPourListDateKey = null
      return
    }

    if (!existing) {
      if (field !== 'dateStart' || !value) {
        savingPourListDateKey = null
        return
      }

      const { data, error } = await supabase
        .from('Dates')
        .insert({
          dateStart: value,
          dateFinish: value,
          id_Pour: pour.id,
          id_Phase: phase.id
        })
        .select('id, dateStart, dateFinish, id_Pour, id_Phase, flag_Complete')
        .single()

      if (error) {
        appError = error.message
        if (inputElement) inputElement.value = ''
      } else {
        allPourDates = [...allPourDates, data]
        if (selectedPour?.id === pour.id) {
          dates = sortDatesByPhaseAndStart([...dates, data])
        }
      }

      savingPourListDateKey = null
      return
    }

    let updates = { [field]: value || null }

    if (field === 'dateStart') {
      const existingGap = daysBetweenDates(existing.dateStart, existing.dateFinish)
      if (existingGap !== null) {
        updates = {
          dateStart: value,
          dateFinish: addDaysToDate(value, existingGap)
        }
      }
    }

    const { data, error } = await supabase
      .from('Dates')
      .update(updates)
      .eq('id', existing.id)
      .eq('flag_Complete', false)
      .select('id, dateStart, dateFinish, id_Pour, id_Phase, flag_Complete')
      .maybeSingle()

    if (error || !data) {
      appError = error?.message || 'This Date is complete or is no longer available for editing.'
      if (inputElement) inputElement.value = existing[field] || ''
    } else {
      allPourDates = allPourDates.map((dateRecord) => dateRecord.id === data.id ? data : dateRecord)
      if (selectedPour?.id === pour.id) {
        dates = sortDatesByPhaseAndStart(
          dates.map((dateRecord) => dateRecord.id === data.id ? data : dateRecord)
        )
      }
    }

    savingPourListDateKey = null
  }

  async function loadDatesForPour(pourId) {
    loadingDates = true
    dateHistoryPhaseId = null
    const { data, error } = await supabase
      .from('Dates')
      .select('id, dateStart, dateFinish, id_Pour, id_Phase, flag_Complete')
      .eq('id_Pour', pourId)
      .order('dateStart', { ascending: true })

    if (error) appError = error.message
    else dates = sortDatesByPhaseAndStart(data ?? [])
    loadingDates = false
  }

  async function createDate(event) {
    event.preventDefault()
    if (!selectedPour || !dateStartInput || !datePhaseInput) return

    creatingDate = true
    appError = ''
    notice = ''

    const payload = {
      dateStart: dateStartInput,
      dateFinish: dateFinishInput || dateStartInput,
      id_Pour: selectedPour.id,
      id_Phase: datePhaseInput
    }

    const { data, error } = await supabase
      .from('Dates')
      .insert(payload)
      .select('id, dateStart, dateFinish, id_Pour, id_Phase, flag_Complete')
      .single()

    if (error) appError = error.message
    else {
      dates = sortDatesByPhaseAndStart([...dates, data])
      dateStartInput = ''
      dateFinishInput = ''
      datePhaseInput = ''
      notice = 'Date record created.'
    }

    creatingDate = false
  }

  async function saveInlineDate(row, field, value, inputElement) {
    if (!selectedPour) return

    const existing = row.dateRecord
    const key = `${row.phase.id}:${field}`
    appError = ''
    notice = ''

    if (!existing) {
      if (field !== 'dateStart') return
      if (!value) return

      savingInlineDateKey = key
      const { data, error } = await supabase
        .from('Dates')
        .insert({
          dateStart: value,
          dateFinish: value,
          id_Pour: selectedPour.id,
          id_Phase: row.phase.id
        })
        .select('id, dateStart, dateFinish, id_Pour, id_Phase, flag_Complete')
        .single()

      if (error) {
        appError = error.message
        if (inputElement) inputElement.value = ''
      } else {
        dates = sortDatesByPhaseAndStart([...dates, data])
        notice = `${row.phase.name} date created.`
      }
      savingInlineDateKey = null
      return
    }

    if (existing.flag_Complete) {
      if (inputElement) inputElement.value = existing[field] || ''
      return
    }

    if (field === 'dateStart' && !value) {
      appError = 'Start date cannot be blank.'
      if (inputElement) inputElement.value = existing.dateStart
      return
    }

    savingInlineDateKey = key

    let updates = { [field]: value || null }
    if (field === 'dateStart') {
      const existingGap = daysBetweenDates(existing.dateStart, existing.dateFinish)
      if (existingGap !== null) {
        updates = {
          dateStart: value,
          dateFinish: addDaysToDate(value, existingGap)
        }
      }
    }

    const { data, error } = await supabase
      .from('Dates')
      .update(updates)
      .eq('id', existing.id)
      .eq('flag_Complete', false)
      .select('id, dateStart, dateFinish, id_Pour, id_Phase, flag_Complete')
      .maybeSingle()

    if (error || !data) {
      appError = error?.message || 'This Date is complete or is no longer available for editing.'
      if (inputElement) inputElement.value = existing[field] || ''
    } else {
      dates = sortDatesByPhaseAndStart(
        dates.map((item) => item.id === data.id ? data : item)
      )
      notice = `${row.phase.name} date updated.`
    }
    savingInlineDateKey = null
  }

  function openDatePicker(event) {
    const input = event.currentTarget
    if (input.disabled) return
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker()
      } catch (error) {
        // Keep the native date control usable when the browser declines.
      }
    }
  }

  function createHistoryDate(event) {
    event?.preventDefault()
    if (!selectedPour || !dateHistoryPhaseId || !historyDateStartInput) return
    historyDraft = [...historyDraft, {
      id: crypto.randomUUID(),
      dateStart: historyDateStartInput,
      dateFinish: historyDateStartInput,
      id_Pour: selectedPour.id,
      id_Phase: dateHistoryPhaseId,
      flag_Complete: false,
      _new: true
    }]
    historyDateStartInput = ''
    showHistoryDateCreate = false
    historyError = ''
  }

  function saveHistoryDate(dateRecord, field, value, inputElement) {
    if (dateRecord.flag_Complete || savingHistory) return
    if (field === 'dateStart' && !value) {
      historyError = 'Start date cannot be blank.'
      if (inputElement) inputElement.value = dateRecord.dateStart
      return
    }
    let updates = { [field]: value || null }
    if (field === 'dateStart') {
      const gap = daysBetweenDates(dateRecord.dateStart, dateRecord.dateFinish)
      if (gap !== null) updates.dateFinish = addDaysToDate(value, gap)
    }
    historyDraft = historyDraft.map((d) => d.id === dateRecord.id ? { ...d, ...updates } : d)
    historyError = ''
  }

  function setHistoryDateComplete(dateRecord, complete) {
    if (savingHistory) return
    historyDraft = historyDraft.map((d) => d.id === dateRecord.id ? { ...d, flag_Complete: complete } : d)
  }

  function deleteHistoryDate(dateRecord) {
    if (savingHistory || !dateRecord) return

    if (dateRecord._new) {
      historyDraft = historyDraft.filter((d) => d.id !== dateRecord.id)
    } else {
      historyDraft = historyDraft.map((d) =>
        d.id === dateRecord.id ? { ...d, _deleted: true } : d
      )
    }

    historyError = ''
  }

  async function saveDateHistory() {
    if (savingHistory || !selectedPour || !dateHistoryPhaseId) return
    const original = new Map(historyOriginal.map((d) => [d.id, d]))
    const changes = historyDraft.filter((d) =>
      d._deleted ||
      d._new ||
      JSON.stringify({
        dateStart: d.dateStart, dateFinish: d.dateFinish, flag_Complete: d.flag_Complete
      }) !== JSON.stringify({
        dateStart: original.get(d.id)?.dateStart,
        dateFinish: original.get(d.id)?.dateFinish,
        flag_Complete: original.get(d.id)?.flag_Complete
      })
    ).map((d) => ({
      id: d.id,
      isNew: !!d._new,
      isDeleted: !!d._deleted,
      dateStart: d.dateStart,
      dateFinish: d.dateFinish,
      flag_Complete: d.flag_Complete
    }))
    if (!changes.length) { closeDateHistory(); return }
    savingHistory = true
    historyError = ''
    const { data, error } = await supabase.rpc('save_date_history', {
      p_pour_id: selectedPour.id,
      p_phase_id: dateHistoryPhaseId,
      p_changes: changes
    })
    if (error) {
      historyError = error.message
    } else {
      allPourDates = [
        ...allPourDates.filter((d) => !(d.id_Pour === selectedPour.id && d.id_Phase === dateHistoryPhaseId)),
        ...data
      ]
      dates = sortDatesByPhaseAndStart([
        ...dates.filter((d) => !(d.id_Pour === selectedPour.id && d.id_Phase === dateHistoryPhaseId)),
        ...data
      ])
      savingHistory = false
      closeDateHistory()
      return
    }
    savingHistory = false
  }

  async function setDateComplete(dateRecord, flagComplete) {
    completingDateId = dateRecord.id
    appError = ''
    notice = ''

    const { data, error } = await supabase
      .from('Dates')
      .update({ flag_Complete: flagComplete })
      .eq('id', dateRecord.id)
      .select('id, dateStart, dateFinish, id_Pour, id_Phase, flag_Complete')
      .single()

    if (error) appError = error.message
    else {
      dates = sortDatesByPhaseAndStart(
        dates.map((item) => item.id === data.id ? data : item)
      )
      notice = flagComplete ? 'Date record marked complete.' : 'Date record marked incomplete.'
    }

    completingDateId = null
  }

  async function deleteDate(dateRecord) {
    if (!confirm('Delete this Dates record? This cannot be undone.')) return
    deletingDateId = dateRecord.id
    appError = ''

    const { error } = await supabase.from('Dates').delete().eq('id', dateRecord.id)
    if (error) appError = error.message
    else dates = dates.filter((item) => item.id !== dateRecord.id)

    deletingDateId = null
  }

  async function saveJobAddressField(field, value) {
    if (!selectedPour?.id_Job || !selectedPour?.job) return

    const key = `job:${field}`
    savingAddressKey = key
    appError = ''

    const { data, error } = await supabase
      .from('Jobs')
      .update({ [field]: value || null })
      .eq('id', selectedPour.id_Job)
      .select('id, seq, created_at, id_Employee, address_LotNumber, address_StreetNumber, address_StreetName, address_Description, address_Suburb, address_Postcode, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
      .single()

    if (error) {
      appError = error.message
    } else {
      jobs = jobs.map((job) => job.id === data.id ? data : job)
      if (selectedJob?.id === data.id) selectedJob = data
      selectedPour = { ...selectedPour, job: data }
    }

    savingAddressKey = null
  }

  async function savePourAddressField(field, value) {
    if (!selectedPour) return

    const key = `pour:${field}`
    savingAddressKey = key
    appError = ''

    const { data, error } = await supabase
      .from('Pours')
      .update({ [field]: value || null })
      .eq('id', selectedPour.id)
      .select('id, id_Job, stageNum, created_at, id_Employee, address_Residence, status, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
      .single()

    if (error) {
      appError = error.message
    } else {
      const job = selectedPour.job
      selectedPour = { ...data, job }
      allPours = allPours.map((pour) => pour.id === data.id ? data : pour)
      pours = pours.map((pour) => pour.id === data.id ? data : pour)
    }

    savingAddressKey = null
  }

  async function navigate(target, historyMode = 'push') {
    writeAppLocation(target, null, historyMode)
    view = target
    selectedJob = null
    selectedPour = null
    selectedPhase = null
    phaseDates = []
    dates = []
    pours = []
    appError = ''
    notice = ''
    if (target === 'jobs') await loadJobs()
    if (target === 'pours') await Promise.all([loadJobs(), loadAllPours()])
    if (target === 'phases') await Promise.all([loadPhases(), loadRolesCompanies(), loadRolesContacts()])
    if (target === 'companies') await Promise.all([loadCompanies(), loadRolesCompanies(), loadRolesContacts()])
    if (target === 'roles-companies') await loadRolesCompanies()
    if (target === 'roles-contacts') await loadRolesContacts()
  }

  async function createJob() {
    creatingJob = true
    appError = ''
    notice = ''

    const { data, error } = await supabase
      .from('Jobs')
      .insert({})
      .select('id, seq, created_at, id_Employee, address_LotNumber, address_StreetNumber, address_StreetName, address_Description, address_Suburb, address_Postcode, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
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

  async function openJob(jobId, historyMode = 'push') {
    writeAppLocation('job', jobId, historyMode)
    view = 'job'
    loadingJob = true
    appError = ''
    notice = ''

    const [{ data: job, error: jobError }, { data: pourRows, error: poursError }] = await Promise.all([
      supabase
        .from('Jobs')
        .select('id, seq, created_at, id_Employee, address_LotNumber, address_StreetNumber, address_StreetName, address_Description, address_Suburb, address_Postcode, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
        .eq('id', jobId)
        .single(),
      supabase
        .from('Pours')
        .select('id, id_Job, stageNum, created_at, id_Employee, address_Residence, status, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
        .eq('id_Job', jobId)
        .order('stageNum', { ascending: true })
    ])

    if (jobError) appError = jobError.message
    if (poursError) appError = poursError.message

    selectedJob = job ?? null
    pours = pourRows ?? []
    loadingJob = false
  }

  async function openPour(pourId, historyMode = 'push') {
    writeAppLocation('pour', pourId, historyMode)
    view = 'pour'
    loadingPour = true
    appError = ''
    notice = ''
    selectedPour = null

    const { data: pour, error: pourError } = await supabase
      .from('Pours')
      .select('id, id_Job, stageNum, created_at, id_Employee, address_Residence, status, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
      .eq('id', pourId)
      .single()

    if (pourError) {
      appError = pourError.message
      loadingPour = false
      return
    }

    let parentJob = jobs.find((job) => job.id === pour.id_Job) ?? null
    if (!parentJob) {
      const { data: job, error: jobError } = await supabase
        .from('Jobs')
        .select('id, seq, created_at, id_Employee, address_LotNumber, address_StreetNumber, address_StreetName, address_Description, address_Suburb, address_Postcode, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
        .eq('id', pour.id_Job)
        .single()

      if (jobError) appError = jobError.message
      parentJob = job ?? null
      if (parentJob && !jobs.some((item) => item.id === parentJob.id)) jobs = [...jobs, parentJob]
    }

    selectedPour = { ...pour, job: parentJob }
    await loadPhases()
    await loadDatesForPour(pour.id)
    loadingPour = false
  }

  function backToPours() {
    navigate('pours')
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
      .select('id, id_Job, stageNum, created_at, id_Employee, address_Residence, status, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
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
        .select('id, seq, created_at, id_Employee, address_LotNumber, address_StreetNumber, address_StreetName, address_Description, address_Suburb, address_Postcode, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
        .single()

      if (jobError) {
        pourCreateError = jobError.message
        creatingPourFromList = false
        return
      }

      const { data: newPour, error: pourError } = await supabase
        .from('Pours')
        .insert({ id_Job: newJob.id })
        .select('id, id_Job, stageNum, created_at, id_Employee, address_Residence, status, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
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
      .select('id, seq, created_at, id_Employee, address_LotNumber, address_StreetNumber, address_StreetName, address_Description, address_Suburb, address_Postcode, creator:Employees!jobs_employee_fk(id, nameFirst, nameLast)')
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
      .select('id, id_Job, stageNum, created_at, id_Employee, address_Residence, status, creator:Employees!pours_employee_fk(id, nameFirst, nameLast)')
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
        <button class:active={view === 'pours' || view === 'pour'} on:click={() => navigate('pours')}>
          <span class="nav-icon">◫</span><span>Pours</span>
        </button>
        <button class:active={view === 'phases' || view === 'phase'} on:click={() => navigate('phases')}>
          <span class="nav-icon">◇</span><span>Phases</span>
        </button>
        <button class:active={view === 'companies' || view === 'company'} on:click={() => navigate('companies')}>
          <span class="nav-icon">▤</span><span>Companies</span>
        </button>
          <button class:active={view === 'roles-companies' || view === 'role-company'} on:click={() => navigate('roles-companies')}>
            <span class="nav-icon">▤</span><span>Company Roles</span>
          </button>
          <button class:active={view === 'roles-contacts' || view === 'role-contact'} on:click={() => navigate('roles-contacts')}>
            <span class="nav-icon">▤</span><span>Contact Roles</span>
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
        <button class:active={view === 'pours' || view === 'pour'} on:click={() => navigate('pours')}>Pours</button>
        <button class:active={view === 'phases' || view === 'phase'} on:click={() => navigate('phases')}>Phases</button>
        <button class:active={view === 'companies' || view === 'company'} on:click={() => navigate('companies')}>Companies</button>
      
            <button class:active={view === 'roles-companies' || view === 'role-company'} on:click={() => navigate('roles-companies')}>Company Roles</button>
            <button class:active={view === 'roles-contacts' || view === 'role-contact'} on:click={() => navigate('roles-contacts')}>Contact Roles</button>
          </nav>

      <main class="content">
        {#if appError}<div class="alert error top-alert">{appError}</div>{/if}

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
            <div><p class="eyebrow">Pours</p><h1>Pours</h1><p>Open any Pour directly using its Job sequence and stage number.</p></div>
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
                <table>
                  <thead>
                    <tr>
                      <th>Pour</th>
                      {#each phases as phase (phase.id)}
                        <th>{phase.name}</th>
                      {/each}
                      <th class="actions-column">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each sortedAllPours as pour}
                      <tr>
                        <td class="pour-open-cell" role="button" tabindex="0" on:click={() => openPour(pour.id)} on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && openPour(pour.id)}><span class="record-link">{pourIdentifier(pour)}</span></td>
                        {#each phases as phase (phase.id)}
                          {@const phaseDate = pourPhaseDate(pour.id, phase.id)}
                          <td class="pour-list-date-cell">
                            <input
                              class="inline-date-input"
                              type="date"
                              on:click={openDatePicker}
                              on:keydown|preventDefault
                              on:paste|preventDefault
                              on:drop|preventDefault
                              value={phaseDate?.dateStart || ''}
                              disabled={phaseDate?.flag_Complete || savingPourListDateKey === `${pour.id}:${phase.id}:dateStart`}
                              aria-label={`${pourIdentifier(pour)} ${phase.name} start date`}
                              on:change={(event) => savePourListDate(pour, phase, 'dateStart', event.currentTarget.value, event.currentTarget)}
                            />
                            <input
                              class="inline-date-input"
                              type="date"
                              on:click={openDatePicker}
                              on:keydown|preventDefault
                              on:paste|preventDefault
                              on:drop|preventDefault
                              value={phaseDate?.dateFinish || ''}
                              min={phaseDate?.dateStart || undefined}
                              disabled={!phaseDate || phaseDate.flag_Complete || savingPourListDateKey === `${pour.id}:${phase.id}:dateFinish`}
                              title={phaseDate ? 'Edit finish date' : 'Enter a start date first to create this Date record'}
                              aria-label={`${pourIdentifier(pour)} ${phase.name} finish date`}
                              on:change={(event) => savePourListDate(pour, phase, 'dateFinish', event.currentTarget.value, event.currentTarget)}
                            />
                            <label class="pour-list-complete">
                              <input
                                type="checkbox"
                                checked={phaseDate?.flag_Complete || false}
                                disabled={!phaseDate || completingPourListDateId === phaseDate.id}
                                aria-label={`Mark ${pourIdentifier(pour)} ${phase.name} date complete`}
                                on:change={(event) => setPourListDateComplete(phaseDate, event.currentTarget.checked)}
                              />
                              <span>Complete</span>
                            </label>
                            <button
                              class="button secondary compact-button pour-list-show-all"
                              type="button"
                              on:click={() => openDateHistory(phase.id, pour)}
                            >
                              Show All
                            </button>
                          </td>
                        {/each}
                        <td class="row-actions"><button class="icon-button danger" title="Delete pour" aria-label={`Delete Pour ${pourIdentifier(pour)}`} disabled={deletingPourId === pour.id} on:click={() => deletePour(pour)}>{deletingPourId === pour.id ? '…' : '×'}</button></td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </section>

        {:else if view === 'companies'}
          <section class="page-heading">
            <div>
              <p class="eyebrow">Companies</p>
              <h1>Companies</h1>
            </div>
            <button class="button primary" on:click={createCompany} disabled={creatingCompany}>
              <span class="plus">+</span>{creatingCompany ? 'Creating…' : 'New Company'}
            </button>
          </section>

          <section class="panel">
            {#if companies.length === 0}
              <div class="empty-state compact"><p>No Companies found.</p></div>
            {:else}
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Roles</th></tr></thead>
                  <tbody>
                    {#each companies as company (company.id)}
                      <tr>
                        <td class="pour-open-cell" role="button" tabindex="0" on:click={() => openCompany(company.id)} on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && openCompany(company.id)}>
                          <span class="record-link">{company.name}</span>
                        </td>
                        <td>{companyRoleNames(company.id_Roles) || '—'}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </section>

        {:else if view === 'company'}
          <button class="back-button" on:click={() => navigate('companies')}>← Back to Companies</button>
          {#if loadingCompany}
            <section class="panel panel-loading">Loading company…</section>
          {:else if selectedCompany}
            <section class="detail-heading">
              <div>
                <p class="eyebrow">Company details</p>
                <h1>{selectedCompany.name}</h1>
              </div>
            </section>

            <section class="panel detail-panel">
              <div class="company-detail-grid">
                <label class="field-label">
                  <span>Name</span>
                  <input type="text" bind:value={companyNameInput} />
                </label>

                <fieldset class="role-picker">
                  <legend>Roles</legend>
                  <div class="role-checkboxes">
                    {#each rolesCompanies as role (role.id)}
                      <label>
                        <input
                          type="checkbox"
                          checked={companyRoleIds.includes(role.id)}
                          on:change={() => toggleCompanyRole(role.id)}
                        />
                        <span>{role.name}</span>
                      </label>
                    {/each}
                  </div>
                </fieldset>

                <div>
                  <button class="button primary" type="button" disabled={savingCompany || !companyNameInput.trim()} on:click={saveCompany}>
                    {savingCompany ? 'Saving…' : 'Save Company'}
                  </button>
                </div>
              </div>
            </section>

            <section class="panel dates-panel">
              <div class="panel-heading">
                <div>
                  <p class="eyebrow">Contacts</p>
                  <h2>Related Contacts</h2>
                </div>
                <div class="panel-heading-actions">
                  <span class="count-badge">{contacts.length}</span>
                  <button class="button primary compact-button" type="button" on:click={openContactCreateModal}>
                    <span class="plus">+</span>New Contact
                  </button>
                </div>
              </div>

              {#if contacts.length === 0}
                <div class="empty-state compact"><p>No Contacts have been created for this Company yet.</p></div>
              {:else}
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Roles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each contacts as contact (contact.id)}
                        <tr>
                          <td>{contact.nameFirst}</td>
                          <td>{contact.nameLast}</td>
                          <td>{contactRoleNames(contact.id_Roles) || '—'}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </section>
          {/if}

        
        {:else if view === 'roles-companies'}
          <section class="page-heading">
            <div>
              <p class="eyebrow">Roles</p>
              <h1>Company Roles</h1>
            </div>
            <button class="button primary" type="button" disabled={creatingRoleCompany} on:click={createRoleCompany}>
              <span class="plus">+</span>{creatingRoleCompany ? 'Creating…' : 'New Role'}
            </button>
          </section>

          <section class="panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">RolesCompanies</p>
                <h2>Company Roles</h2>
              </div>
              <span class="count-badge">{rolesCompanies.length}</span>
            </div>

            {#if rolesCompanies.length === 0}
              <div class="empty-state compact"><p>No Company Roles have been created yet.</p></div>
            {:else}
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Name</th></tr></thead>
                  <tbody>
                    {#each rolesCompanies as role (role.id)}
                      <tr class="clickable-row" on:click={() => openRoleCompany(role.id)}>
                        <td><button class="record-link" on:click|stopPropagation={() => openRoleCompany(role.id)}>{role.name}</button></td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </section>

        {:else if view === 'role-company'}
          <button class="back-button" on:click={() => navigate('roles-companies')}>← Back to Company Roles</button>
          {#if loadingRoleCompany}
            <section class="panel panel-loading">Loading Company Role…</section>
          {:else if selectedRoleCompany}
            <section class="detail-heading">
              <div>
                <p class="eyebrow">Company Role</p>
                <h1>{selectedRoleCompany.name}</h1>
              </div>
            </section>

            <section class="panel detail-panel">
              <div class="address-edit-grid">
                <label class="field-label">
                  <span>Name</span>
                  <input type="text" bind:value={roleCompanyNameInput} />
                </label>
              </div>

              <div class="modal-actions detail-actions">
                <button
                  class="button primary"
                  type="button"
                  disabled={savingRoleCompany || !roleCompanyNameInput.trim()}
                  on:click={saveRoleCompany}
                >
                  {savingRoleCompany ? 'Saving…' : 'Save'}
                </button>
              </div>
            </section>
          {/if}

        {:else if view === 'roles-contacts'}
          <section class="page-heading">
            <div>
              <p class="eyebrow">Roles</p>
              <h1>Contact Roles</h1>
            </div>
            <button class="button primary" type="button" disabled={creatingRoleContact} on:click={createRoleContact}>
              <span class="plus">+</span>{creatingRoleContact ? 'Creating…' : 'New Role'}
            </button>
          </section>

          <section class="panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">RolesContacts</p>
                <h2>Contact Roles</h2>
              </div>
              <span class="count-badge">{rolesContacts.length}</span>
            </div>

            {#if rolesContacts.length === 0}
              <div class="empty-state compact"><p>No Contact Roles have been created yet.</p></div>
            {:else}
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Name</th></tr></thead>
                  <tbody>
                    {#each rolesContacts as role (role.id)}
                      <tr class="clickable-row" on:click={() => openRoleContact(role.id)}>
                        <td><button class="record-link" on:click|stopPropagation={() => openRoleContact(role.id)}>{role.name}</button></td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </section>

        {:else if view === 'role-contact'}
          <button class="back-button" on:click={() => navigate('roles-contacts')}>← Back to Contact Roles</button>
          {#if loadingRoleContact}
            <section class="panel panel-loading">Loading Contact Role…</section>
          {:else if selectedRoleContact}
            <section class="detail-heading">
              <div>
                <p class="eyebrow">Contact Role</p>
                <h1>{selectedRoleContact.name}</h1>
              </div>
            </section>

            <section class="panel detail-panel">
              <div class="address-edit-grid">
                <label class="field-label">
                  <span>Name</span>
                  <input type="text" bind:value={roleContactNameInput} />
                </label>
              </div>

              <div class="modal-actions detail-actions">
                <button
                  class="button primary"
                  type="button"
                  disabled={savingRoleContact || !roleContactNameInput.trim()}
                  on:click={saveRoleContact}
                >
                  {savingRoleContact ? 'Saving…' : 'Save'}
                </button>
              </div>
            </section>
          {/if}

{:else if view === 'phases'}
          <section class="page-heading">
            <div>
              <p class="eyebrow">Phases</p>
              <h1>Phases</h1>
              <p>Manage the reusable phases that can be assigned to Pour Dates records.</p>
            </div>
            <button class="button primary" type="button" disabled={creatingPhase} on:click={createPhase}>
              <span class="plus">+</span>{creatingPhase ? 'Creating…' : 'New Phase'}
            </button>
          </section>

          <section class="panel list-panel">
            <div class="panel-heading"><div><p class="eyebrow">Phase register</p><h2>All phases</h2></div><span class="count-badge">{phases.length}</span></div>
            {#if loadingPhases}
              <div class="panel-loading">Loading phases…</div>
            {:else if phases.length === 0}
              <div class="empty-state compact"><h3>No Phases yet</h3><p>Create your first Phase above.</p></div>
            {:else}
              <div class="table-wrap">
                <table><thead><tr><th class="drag-column"></th><th>Phase</th></tr></thead><tbody>
                  {#each phases as phase (phase.id)}
                    <tr
                      class:phase-dragging={draggedPhaseId === phase.id}
                      class:phase-drop-target={phaseDropTargetId === phase.id && draggedPhaseId !== phase.id}
                      draggable="true"
                      on:dragstart={() => startPhaseDrag(phase.id)}
                      on:dragover|preventDefault={() => overPhaseDrag(phase.id)}
                      on:drop|preventDefault={() => dropPhaseOn(phase.id)}
                      on:dragend={endPhaseDrag}
                    >
                      <td class="drag-cell"><span class="drag-handle" title="Drag to reorder" aria-label="Drag to reorder">⋮⋮</span></td>
                      <td class="phase-click-cell" on:click={() => openPhase(phase.id)}>{phase.name}</td>
                    </tr>
                  {/each}
                </tbody></table>
              </div>
            {/if}
          </section>
        {:else if view === 'phase'}
          <button class="back-button" on:click={() => navigate('phases')}>← Back to Phases</button>
          {#if loadingPhase}
            <section class="panel panel-loading">Loading phase…</section>
          {:else if selectedPhase}
            <section class="detail-heading"><div><p class="eyebrow">Phase details</p><h1>{selectedPhase.name}</h1></div></section>
            <section class="panel detail-panel phase-detail-panel">
              <div class="panel-heading phase-detail-heading">
                <div>
                  <p class="eyebrow">Phase</p>
                  <h2>Phase configuration</h2>
                </div>
              </div>

              <div class="phase-detail-content">
                <form class="phase-detail-form" on:submit={updatePhaseSort}>
                  <div class="phase-summary-row">
                    <label class="field-label">
                      <span>Name</span>
                      <input bind:value={phaseDetailNameInput} type="text" required />
                    </label>
                  </div>
                  <div class="address-edit-grid phase-detail-grid">
                    <label class="field-label">
                      <span>Role Type</span>
                      <select bind:value={phaseTypeRoleInput}>
                        <option value=""></option>
                        <option value="Company">Company</option>
                        <option value="Contact">Contact</option>
                      </select>
                    </label>

                    {#if phaseTypeRoleInput === 'Company'}
                      <label class="field-label">
                        <span>Company Role</span>
                        <select bind:value={phaseRoleCompanyId}>
                          <option value=""></option>
                          {#each rolesCompanies as role (role.id)}
                            <option value={role.id}>{role.name}</option>
                          {/each}
                        </select>
                      </label>
                    {:else if phaseTypeRoleInput === 'Contact'}
                      <label class="field-label">
                        <span>Contact Role</span>
                        <select bind:value={phaseRoleContactId}>
                          <option value=""></option>
                          {#each rolesContacts as role (role.id)}
                            <option value={role.id}>{role.name}</option>
                          {/each}
                        </select>
                      </label>
                    {/if}
                  </div>

                  <div class="phase-detail-actions">
                    <button
                      class="button primary"
                      type="submit"
                      disabled={updatingPhase || !phaseDetailNameInput.trim()}
                    >
                      {updatingPhase ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </section>
            
          {/if}
        {:else if view === 'pour'}
          <button class="back-button" on:click={backToPours}>← Back to Pours</button>
          {#if loadingPour}
            <section class="panel panel-loading">Loading pour…</section>
          {:else if selectedPour}
            <section class="detail-heading">
              <div>
                <p class="eyebrow">Pour details</p>
                <h1>{selectedPour.job?.seq ?? 'Unknown'}-{selectedPour.stageNum}</h1>
                <p class="creator-line">Created {formatDateTime(selectedPour.created_at)}{#if selectedPour.creator} by {employeeName(selectedPour.creator)}{/if}</p>
              </div>
            </section>

            <section class="panel detail-panel">
              <div class="detail-grid">
                <div class="detail-field">
                  <span class="detail-label">Pour</span>
                  <strong>{selectedPour.job?.seq ?? 'Unknown'}-{selectedPour.stageNum}</strong>
                </div>
                <div class="detail-field">
                  <span class="detail-label">Job</span>
                  {#if selectedPour.job}
                    <button class="record-link" on:click={() => openJob(selectedPour.id_Job)}>Job {selectedPour.job.seq}</button>
                  {:else}
                    <strong>Unknown Job</strong>
                  {/if}
                </div>
                <div class="detail-field">
                  <span class="detail-label">Stage</span>
                  <strong>{selectedPour.stageNum}</strong>
                </div>
              </div>

              <div class="detail-section-divider"></div>
              <div class="panel-heading address-heading">
                <div>
                  <p class="eyebrow">Address</p>
                  <h2>Job and Pour address</h2>
                </div>
              </div>

              <div class="address-edit-grid">
                <label class="field-label">
                  <span>Lot Number</span>
                  <input
                    type="text"
                    value={selectedPour.job?.address_LotNumber || ''}
                    disabled={savingAddressKey === 'job:address_LotNumber'}
                    on:change={(event) => saveJobAddressField('address_LotNumber', event.currentTarget.value)}
                  />
                </label>
                <label class="field-label">
                  <span>Street Number</span>
                  <input
                    type="text"
                    value={selectedPour.job?.address_StreetNumber || ''}
                    disabled={savingAddressKey === 'job:address_StreetNumber'}
                    on:change={(event) => saveJobAddressField('address_StreetNumber', event.currentTarget.value)}
                  />
                </label>
                <label class="field-label">
                  <span>Street Name</span>
                  <input
                    type="text"
                    value={selectedPour.job?.address_StreetName || ''}
                    disabled={savingAddressKey === 'job:address_StreetName'}
                    on:change={(event) => saveJobAddressField('address_StreetName', event.currentTarget.value)}
                  />
                </label>
                <label class="field-label">
                  <span>Description</span>
                  <input
                    type="text"
                    value={selectedPour.job?.address_Description || ''}
                    disabled={savingAddressKey === 'job:address_Description'}
                    on:change={(event) => saveJobAddressField('address_Description', event.currentTarget.value)}
                  />
                </label>
                <label class="field-label">
                  <span>Suburb</span>
                  <input
                    type="text"
                    value={selectedPour.job?.address_Suburb || ''}
                    disabled={savingAddressKey === 'job:address_Suburb'}
                    on:change={(event) => saveJobAddressField('address_Suburb', event.currentTarget.value)}
                  />
                </label>
                <label class="field-label">
                  <span>Postcode</span>
                  <input
                    type="text"
                    value={selectedPour.job?.address_Postcode || ''}
                    disabled={savingAddressKey === 'job:address_Postcode'}
                    on:change={(event) => saveJobAddressField('address_Postcode', event.currentTarget.value)}
                  />
                </label>
                <label class="field-label address-residence-field">
                  <span>Residence</span>
                  <input
                    type="text"
                    value={selectedPour.address_Residence || ''}
                    disabled={savingAddressKey === 'pour:address_Residence'}
                    on:change={(event) => savePourAddressField('address_Residence', event.currentTarget.value)}
                  />
                </label>
              </div>
            </section>

            <section class="panel dates-panel">
              <div class="panel-heading"><div><p class="eyebrow">Dates</p><h2>Dates for this Pour</h2></div><span class="count-badge">{pourPhaseRows.length}</span></div>

              {#if phases.length === 0}<div class="inline-note">Create a Phase first before adding Dates records.</div>{/if}
              {#if loadingDates}
                <div class="panel-loading">Loading dates…</div>
              {:else if phases.length === 0}
                <div class="empty-state compact"><p>No Phases have been created yet.</p></div>
              {:else}
                <div class="table-wrap"><table><thead><tr><th>Phase</th><th>Start</th><th>Finish</th><th>Complete</th><th class="actions-column">Actions</th></tr></thead><tbody>
                  {#each pourPhaseRows as row (row.phase.id)}
                    <tr>
                      <td><button class="record-link" on:click={() => openPhase(row.phase.id)}>{row.phase.name}</button></td>
                      <td>
                        <input
                          class="inline-date-input"
                          type="date"
                            on:click={openDatePicker}
                          on:keydown|preventDefault
                          on:paste|preventDefault
                          on:drop|preventDefault
                          value={row.dateRecord?.dateStart || ''}
                          disabled={row.dateRecord?.flag_Complete || savingInlineDateKey === `${row.phase.id}:dateStart`}
                          aria-label={`${row.phase.name} start date`}
                          on:change={(event) => saveInlineDate(row, 'dateStart', event.currentTarget.value, event.currentTarget)}
                        />
                      </td>
                      <td>
                        <input
                          class="inline-date-input"
                          type="date"
                            on:click={openDatePicker}
                          on:keydown|preventDefault
                          on:paste|preventDefault
                          on:drop|preventDefault
                          value={row.dateRecord?.dateFinish || ''}
                          min={row.dateRecord?.dateStart || undefined}
                          disabled={!row.dateRecord || row.dateRecord.flag_Complete || savingInlineDateKey === `${row.phase.id}:dateFinish`}
                          title={row.dateRecord ? 'Edit finish date' : 'Enter a start date first to create this Date record'}
                          aria-label={`${row.phase.name} finish date`}
                          on:change={(event) => saveInlineDate(row, 'dateFinish', event.currentTarget.value, event.currentTarget)}
                        />
                      </td>
                      <td>
                        {#if row.dateRecord}
                          <input type="checkbox" checked={row.dateRecord.flag_Complete} disabled={completingDateId === row.dateRecord.id} aria-label={`Mark ${row.phase.name} date complete`} on:change={(event) => setDateComplete(row.dateRecord, event.currentTarget.checked)} />
                        {:else}
                          <input type="checkbox" disabled aria-label={`No ${row.phase.name} date record to complete`} />
                        {/if}
                      </td>
                      <td class="row-actions date-row-actions">
                        <button class="button secondary compact-button" type="button" on:click={() => openDateHistory(row.phase.id)}>Show All</button>
                        {#if row.dateRecord}
                          <button class="icon-button danger" title="Delete date" aria-label="Delete date record" disabled={deletingDateId === row.dateRecord.id || completingDateId === row.dateRecord.id} on:click={() => deleteDate(row.dateRecord)}>{deletingDateId === row.dateRecord.id ? '…' : '×'}</button>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody></table></div>
              {/if}
            </section>
          {/if}
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

    {#if dateHistoryPhaseId}
      <div class="modal-backdrop" role="presentation"  disabled={savingHistory}>
        <section class="modal-card date-history-modal" role="dialog" aria-modal="true" aria-labelledby="date-history-title" on:click|stopPropagation>
          <div class="modal-heading">
            <div>
              <p class="eyebrow">Date history</p>
              <h2 id="date-history-title">{phaseName(dateHistoryPhaseId)}</h2>
              <p>All Dates for Pour {selectedPour ? pourIdentifier(selectedPour) : ''} and this Phase.</p>
            </div>
            <div class="modal-heading-actions">
              <button class="button primary compact-button" type="button" on:click={() => (showHistoryDateCreate = !showHistoryDateCreate)}>
                <span class="plus">+</span> New Date
              </button>
</div>
          </div>
          <div class="modal-body">
            {#if historyError}<div class="alert error">{historyError}</div>{/if}
            {#if showHistoryDateCreate}
              <form class="history-date-create" on:submit={createHistoryDate}>
                <label class="field-label">
                  <span>Start date</span>
                  <input
                    class="inline-date-input"
                    type="date"
                    on:click={openDatePicker}
                    on:keydown|preventDefault
                    on:paste|preventDefault
                    on:drop|preventDefault
                    bind:value={historyDateStartInput}
                    required
                    aria-label={`New ${phaseName(dateHistoryPhaseId)} start date`}
                  />
                </label>
                <button class="button primary compact-button" type="submit" disabled={savingHistory || !historyDateStartInput}>
                  {creatingHistoryDate ? 'Creating…' : 'Create'}
                </button>
              </form>
            {/if}
            {#if dateHistoryRecords.length === 0}
              <div class="empty-state compact"><p>No Dates records found for this Pour and Phase.</p></div>
            {:else}
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Start</th><th>Finish</th><th>Complete</th><th class="actions-column">Actions</th></tr></thead>
                  <tbody>
                    {#each dateHistoryRecords as relatedDate (relatedDate.id)}
                      <tr>
                        <td>
                          <input
                            class="inline-date-input"
                            type="date"
                            on:click={openDatePicker}
                            on:keydown|preventDefault
                            on:paste|preventDefault
                            on:drop|preventDefault
                            value={relatedDate.dateStart}
                            disabled={savingHistory || relatedDate.flag_Complete}
                            aria-label={`${phaseName(relatedDate.id_Phase)} history start date`}
                            on:change={(event) => saveHistoryDate(relatedDate, 'dateStart', event.currentTarget.value, event.currentTarget)}
                          />
                        </td>
                        <td>
                          <input
                            class="inline-date-input"
                            type="date"
                            on:click={openDatePicker}
                            on:keydown|preventDefault
                            on:paste|preventDefault
                            on:drop|preventDefault
                            value={relatedDate.dateFinish || ''}
                            disabled={savingHistory || relatedDate.flag_Complete}
                            aria-label={`${phaseName(relatedDate.id_Phase)} history finish date`}
                            on:change={(event) => saveHistoryDate(relatedDate, 'dateFinish', event.currentTarget.value, event.currentTarget)}
                          />
                        </td>
                        <td><input type="checkbox" checked={relatedDate.flag_Complete} disabled={savingHistory} aria-label={`Set ${phaseName(relatedDate.id_Phase)} date completion`} on:change={(event) => setHistoryDateComplete(relatedDate, event.currentTarget.checked)} /></td>
                        <td class="row-actions">
                          <button
                            class="icon-button danger"
                            type="button"
                            title="Delete date"
                            aria-label={`Delete ${phaseName(relatedDate.id_Phase)} date record`}
                            disabled={savingHistory}
                            on:click={() => deleteHistoryDate(relatedDate)}
                          >×</button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
            <div class="modal-actions">
              <button class="button secondary" type="button" on:click={closeDateHistory} disabled={savingHistory}>Cancel</button>
              <button class="button primary" type="button" on:click={saveDateHistory} disabled={savingHistory}>{savingHistory ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </section>
      </div>
    {/if}

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
      {#if showContactCreateModal}
        <div class="modal-backdrop">
          <section class="modal-card history-modal contact-modal" role="dialog" aria-modal="true" aria-labelledby="contact-create-title">
            <div class="contact-modal-header">
              <div>
                <p class="eyebrow">Contact</p>
                <h2 id="contact-create-title">New Contact</h2>
              </div>
            </div>

            <div class="contact-modal-content">
              <div class="address-edit-grid contact-edit-grid">
                <label class="field-label">
                  <span>First Name</span>
                  <input
                    type="text"
                    bind:value={contactFirstInput}
                    autocomplete="given-name"
                    />
                </label>

                <label class="field-label">
                  <span>Last Name</span>
                  <input
                    type="text"
                    bind:value={contactLastInput}
                    autocomplete="family-name"
                    />
                </label>

                <div class="field-label contact-role-field">
                  <span>Roles</span>
                  {#if rolesContacts.length === 0}
                    <p class="inline-note">No Contact Roles have been created yet.</p>
                  {:else}
                    <div class="role-options">
                      {#each rolesContacts as role (role.id)}
                        <label class="role-option">
                          <input
                            type="checkbox"
                            checked={contactRoleIds.includes(role.id)}
                            on:change={() => toggleContactRole(role.id)}
                          />
                          <span>{role.name}</span>
                        </label>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            </div>

            <div class="contact-modal-footer">
              <div class="modal-actions">
                <button class="button secondary" type="button" disabled={creatingContact} on:click={closeContactCreateModal}>
                  Cancel
                </button>
                <button
                  class="button primary"
                  type="button"
                  disabled={creatingContact || !contactFirstInput.trim() || !contactLastInput.trim()}
                  on:click={createContact}
                >
                  {creatingContact ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </section>
        </div>
      {/if}

{/if}
