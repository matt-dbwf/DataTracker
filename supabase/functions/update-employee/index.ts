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
    .select('id, id_User, flag_Manager')
    .eq('id_User', callerData.user.id)
    .maybeSingle()

  if (callerEmployeeError) return json({ error: callerEmployeeError.message }, 500)
  if (!callerEmployee) return json({ error: 'No Employee is linked to this user.' }, 403)

  let body: {
    employeeId?: string
    nameFirst?: string
    nameLast?: string
    email?: string | null
    flagManager?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const employeeId = body.employeeId?.trim()
  const nameFirst = body.nameFirst?.trim()
  const nameLast = body.nameLast?.trim()
  const email = body.email?.trim().toLowerCase() || null

  if (!employeeId || !nameFirst || !nameLast) {
    return json({ error: 'Employee, first name and last name are required.' }, 400)
  }

  const isSelf = callerEmployee.id === employeeId
  if (!isSelf && !callerEmployee.flag_Manager) {
    return json({ error: 'Manager access is required to edit another Employee.' }, 403)
  }

  const { data: target, error: targetError } = await admin
    .from('Employees')
    .select('id, nameFirst, nameLast, email, id_User, flag_Manager')
    .eq('id', employeeId)
    .maybeSingle()

  if (targetError) return json({ error: targetError.message }, 500)
  if (!target) return json({ error: 'Employee not found.' }, 404)

  const managerValue = callerEmployee.flag_Manager
    ? !!body.flagManager
    : !!target.flag_Manager

  const oldEmail = target.email?.toLowerCase() || null
  const emailChanged = email !== oldEmail

  // Linked Employees must keep Employees.email and Auth email synchronized.
  if (target.id_User && emailChanged) {
    if (!email) {
      return json({ error: 'A linked user must have an email address.' }, 400)
    }

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(target.id_User, {
      email,
      email_confirm: true,
    })

    if (authUpdateError) {
      return json({ error: authUpdateError.message }, 400)
    }
  }

  const { data: updatedEmployee, error: updateError } = await admin
    .from('Employees')
    .update({
      nameFirst,
      nameLast,
      email,
      flag_Manager: managerValue,
    })
    .eq('id', employeeId)
    .select('id, nameFirst, nameLast, email, id_User, flag_Manager')
    .single()

  if (updateError) {
    // Best-effort rollback if Auth email was already changed.
    if (target.id_User && emailChanged && oldEmail) {
      await admin.auth.admin.updateUserById(target.id_User, {
        email: oldEmail,
        email_confirm: true,
      })
    }

    return json({ error: updateError.message }, 500)
  }

  return json({ employee: updatedEmployee })
})
