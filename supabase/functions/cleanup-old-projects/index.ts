import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authentication check - verify the caller has a valid JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('Unauthorized: No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's JWT to verify their identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.log('Unauthorized: Invalid token', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User authenticated: ${user.id}`);

    // Authorization check - verify the user is a manager
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || roleData.role !== 'manager') {
      console.log('Forbidden: User is not a manager', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only managers can perform this action' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Manager role verified for user: ${user.id}`);

    // Find projects that have been finished for more than 1 month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    console.log(`Looking for finished projects older than: ${oneMonthAgo.toISOString()}`);

    // Get projects to delete
    const { data: projectsToDelete, error: fetchError } = await supabase
      .from('projects')
      .select('id, name, finished_at')
      .eq('status', 'finished')
      .not('finished_at', 'is', null)
      .lt('finished_at', oneMonthAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching projects:', fetchError);
      throw fetchError;
    }

    if (!projectsToDelete || projectsToDelete.length === 0) {
      console.log('No projects to delete');
      return new Response(
        JSON.stringify({ message: 'No projects to delete', deleted: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${projectsToDelete.length} projects to delete:`, projectsToDelete.map(p => p.name));

    const projectIds = projectsToDelete.map(p => p.id);

    // Delete all related data in order (respecting foreign key constraints)
    // 1. Delete job-related data first
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id')
      .in('project_id', projectIds);

    if (jobs && jobs.length > 0) {
      const jobIds = jobs.map(j => j.id);

      // Delete job completions and related data
      const { data: completions } = await supabase
        .from('job_completions')
        .select('id')
        .in('job_id', jobIds);

      if (completions && completions.length > 0) {
        const completionIds = completions.map(c => c.id);
        
        // Delete job completion photos
        await supabase.from('job_completion_photos').delete().in('completion_id', completionIds);
        console.log('Deleted job completion photos');
        
        // Delete job collaborators
        await supabase.from('job_collaborators').delete().in('job_completion_id', completionIds);
        console.log('Deleted job collaborators');
      }

      // Delete job completions
      await supabase.from('job_completions').delete().in('job_id', jobIds);
      console.log('Deleted job completions');

      // Delete job time tracking
      await supabase.from('job_time_tracking').delete().in('job_id', jobIds);
      console.log('Deleted job time tracking');

      // Delete job materials
      await supabase.from('job_materials').delete().in('job_id', jobIds);
      console.log('Deleted job materials');

      // Delete job photos
      await supabase.from('job_photos').delete().in('job_id', jobIds);
      console.log('Deleted job photos');

      // Delete jobs
      await supabase.from('jobs').delete().in('project_id', projectIds);
      console.log('Deleted jobs');
    }

    // 2. Delete material usage
    await supabase.from('material_usage').delete().in('project_id', projectIds);
    console.log('Deleted material usage');

    // 3. Delete time tracking
    await supabase.from('time_tracking').delete().in('project_id', projectIds);
    console.log('Deleted time tracking');

    // 4. Delete invoices and invoice items
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id')
      .in('project_id', projectIds);

    if (invoices && invoices.length > 0) {
      const invoiceIds = invoices.map(i => i.id);
      await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds);
      console.log('Deleted invoice items');
    }

    await supabase.from('invoices').delete().in('project_id', projectIds);
    console.log('Deleted invoices');

    // 5. Delete daily reports and photos
    const { data: reports } = await supabase
      .from('daily_reports')
      .select('id')
      .in('project_id', projectIds);

    if (reports && reports.length > 0) {
      const reportIds = reports.map(r => r.id);
      await supabase.from('daily_report_photos').delete().in('report_id', reportIds);
      console.log('Deleted daily report photos');
    }

    await supabase.from('daily_reports').delete().in('project_id', projectIds);
    console.log('Deleted daily reports');

    // 6. Delete risk assessments and signatures
    const { data: assessments } = await supabase
      .from('risk_assessments')
      .select('id')
      .in('project_id', projectIds);

    if (assessments && assessments.length > 0) {
      const assessmentIds = assessments.map(a => a.id);
      await supabase.from('risk_assessment_signatures').delete().in('risk_assessment_id', assessmentIds);
      console.log('Deleted risk assessment signatures');
    }

    await supabase.from('risk_assessments').delete().in('project_id', projectIds);
    console.log('Deleted risk assessments');

    // 7. Delete project switches
    await supabase.from('project_switches').delete().in('to_project_id', projectIds);
    await supabase.from('project_switches').delete().in('from_project_id', projectIds);
    console.log('Deleted project switches');

    // 8. Finally delete the projects
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .in('id', projectIds);

    if (deleteError) {
      console.error('Error deleting projects:', deleteError);
      throw deleteError;
    }

    console.log(`Successfully deleted ${projectsToDelete.length} projects and all related data by manager ${user.id}`);

    return new Response(
      JSON.stringify({ 
        message: `Deleted ${projectsToDelete.length} old finished projects`,
        deleted: projectsToDelete.length,
        projectNames: projectsToDelete.map(p => p.name)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in cleanup-old-projects:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
