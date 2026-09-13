import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  let serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? null

  if (!serviceKey) {
    const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
    if (secretKeys) {
      try {
        const parsed = JSON.parse(secretKeys)
        serviceKey = parsed.default ?? Object.values(parsed)[0] ?? null
      } catch (_) {}
    }
  }

  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Supabase server credentials are not configured.' }, 500)
  }

  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return json({ error: 'Authentication required.' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const accessToken = authorization.slice('Bearer '.length)
  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken)
  if (callerError || !callerData.user) return json({ error: 'Invalid or expired session.' }, 401)

  const { data: callerEmployee, error: callerEmployeeError } = await admin
    .from('Employees')
    .select('id, flag_Manager')
    .eq('id_User', callerData.user.id)
    .maybeSingle()

  if (callerEmployeeError) return json({ error: callerEmployeeError.message }, 500)
  if (!callerEmployee?.flag_Manager) return json({ error: 'Manager access is required.' }, 403)

  let body: { employeeId?: string; email?: string; password?: string; flagManager?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const employeeId = body.employeeId?.trim()
  const email = body.email?.trim().toLowerCase()
  const password = body.password ?? ''
  const flagManager = !!body.flagManager

  if (!employeeId || !email || password.length < 8) {
    return json({ error: 'Employee, email and a password of at least 8 characters are required.' }, 400)
  }

  const { data: target, error: targetError } = await admin
    .from('Employees')
    .select('id, nameFirst, nameLast, email, id_User, flag_Manager')
    .eq('id', employeeId)
    .maybeSingle()

  if (targetError) return json({ error: targetError.message }, 500)
  if (!target) return json({ error: 'Employee not found.' }, 404)
  if (target.id_User) return json({ error: 'This Employee already has a linked user account.' }, 409)

  // The database auth.users trigger sees employee_id and links this new Auth user
  // to the existing Employee instead of creating a duplicate Employee record.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      employee_id: employeeId,
      flag_manager: flagManager,
      name_first: target.nameFirst,
      name_last: target.nameLast,
    },
  })

  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'Unable to create user.' }, 400)
  }

  const { data: linkedEmployee, error: linkedError } = await admin
    .from('Employees')
    .select('id, nameFirst, nameLast, email, id_User, flag_Manager')
    .eq('id', employeeId)
    .eq('id_User', created.user.id)
    .maybeSingle()

  if (linkedError || !linkedEmployee) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json({
      error: linkedError?.message ?? 'The Auth user was created but could not be linked to the Employee. The Auth user was rolled back.',
    }, 500)
  }

  return json({ employee: linkedEmployee })
})
