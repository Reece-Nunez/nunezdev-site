import { supabaseAdmin } from './supabaseAdmin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  category: 'client' | 'admin' | 'technical';
  order_index: number;
  is_required: boolean;
  estimated_time_minutes?: number;
  depends_on?: string[]; // Task IDs this depends on
}

interface OnboardingTemplate {
  id: string;
  name: string;
  project_type: string;
  tasks: OnboardingTask[];
}

export class ClientOnboardingService {
  private supabase = supabaseAdmin();

  // Default onboarding templates
  private templates: OnboardingTemplate[] = [
    {
      id: 'web_design_standard',
      name: 'Standard Website Design',
      project_type: 'web-design',
      tasks: [
        {
          id: 'welcome_call',
          title: 'Welcome call scheduled',
          description: 'Initial project kickoff call to discuss requirements and timeline',
          category: 'admin',
          order_index: 1,
          is_required: true,
          estimated_time_minutes: 60
        },
        {
          id: 'brand_assets',
          title: 'Provide brand assets',
          description: 'Logo files, brand guidelines, color schemes, fonts, existing marketing materials',
          category: 'client',
          order_index: 2,
          is_required: true,
          estimated_time_minutes: 30
        },
        {
          id: 'content_gathering',
          title: 'Content and copy provided',
          description: 'Website copy, images, videos, product descriptions, company information',
          category: 'client',
          order_index: 3,
          is_required: true,
          estimated_time_minutes: 120
        },
        {
          id: 'domain_access',
          title: 'Domain and hosting access',
          description: 'Domain registrar login, DNS management access, hosting account details',
          category: 'client',
          order_index: 4,
          is_required: true,
          estimated_time_minutes: 15
        },
        {
          id: 'google_analytics',
          title: 'Analytics accounts setup',
          description: 'Google Analytics, Google Search Console, Google My Business access',
          category: 'client',
          order_index: 5,
          is_required: false,
          estimated_time_minutes: 20
        },
        {
          id: 'competitor_analysis',
          title: 'Competitor analysis completed',
          description: 'Research competitor websites and industry best practices',
          category: 'admin',
          order_index: 6,
          is_required: true,
          estimated_time_minutes: 90,
          depends_on: ['welcome_call']
        },
        {
          id: 'wireframes',
          title: 'Wireframes approved',
          description: 'Initial page layouts and structure approved by client',
          category: 'admin',
          order_index: 7,
          is_required: true,
          estimated_time_minutes: 180,
          depends_on: ['content_gathering', 'competitor_analysis']
        },
        {
          id: 'design_mockups',
          title: 'Design mockups approved',
          description: 'Visual designs for all pages approved by client',
          category: 'admin',
          order_index: 8,
          is_required: true,
          estimated_time_minutes: 240,
          depends_on: ['wireframes', 'brand_assets']
        },
        {
          id: 'development_setup',
          title: 'Development environment setup',
          description: 'Local development environment, staging server, version control',
          category: 'technical',
          order_index: 9,
          is_required: true,
          estimated_time_minutes: 60,
          depends_on: ['domain_access']
        },
        {
          id: 'content_integration',
          title: 'Content integrated into design',
          description: 'All provided content and copy integrated into website',
          category: 'technical',
          order_index: 10,
          is_required: true,
          estimated_time_minutes: 180,
          depends_on: ['design_mockups', 'content_gathering']
        },
        {
          id: 'functionality_testing',
          title: 'Functionality testing completed',
          description: 'All features tested across devices and browsers',
          category: 'technical',
          order_index: 11,
          is_required: true,
          estimated_time_minutes: 120,
          depends_on: ['content_integration']
        },
        {
          id: 'client_review',
          title: 'Client review and feedback',
          description: 'Client reviews staging site and provides final feedback',
          category: 'client',
          order_index: 12,
          is_required: true,
          estimated_time_minutes: 60,
          depends_on: ['functionality_testing']
        },
        {
          id: 'launch_preparation',
          title: 'Launch preparation completed',
          description: 'DNS setup, SSL certificates, final optimizations',
          category: 'technical',
          order_index: 13,
          is_required: true,
          estimated_time_minutes: 90,
          depends_on: ['client_review']
        },
        {
          id: 'go_live',
          title: 'Website launched',
          description: 'Site is live and all redirects/monitoring are in place',
          category: 'technical',
          order_index: 14,
          is_required: true,
          estimated_time_minutes: 60,
          depends_on: ['launch_preparation']
        },
        {
          id: 'handover_training',
          title: 'Client training completed',
          description: 'CMS training, maintenance instructions, documentation provided',
          category: 'admin',
          order_index: 15,
          is_required: true,
          estimated_time_minutes: 90,
          depends_on: ['go_live']
        }
      ]
    },
    {
      id: 'maintenance_plan',
      name: 'Website Maintenance Plan',
      project_type: 'maintenance',
      tasks: [
        {
          id: 'site_audit',
          title: 'Initial site audit',
          description: 'Complete audit of current website performance, security, and optimization',
          category: 'admin',
          order_index: 1,
          is_required: true,
          estimated_time_minutes: 120
        },
        {
          id: 'access_setup',
          title: 'Access credentials collected',
          description: 'Hosting, domain, CMS, and analytics access credentials',
          category: 'client',
          order_index: 2,
          is_required: true,
          estimated_time_minutes: 15
        },
        {
          id: 'backup_setup',
          title: 'Backup systems configured',
          description: 'Automated daily backups and recovery procedures established',
          category: 'technical',
          order_index: 3,
          is_required: true,
          estimated_time_minutes: 60,
          depends_on: ['access_setup']
        },
        {
          id: 'monitoring_setup',
          title: 'Monitoring tools configured',
          description: 'Uptime monitoring, security scanning, performance tracking',
          category: 'technical',
          order_index: 4,
          is_required: true,
          estimated_time_minutes: 45,
          depends_on: ['access_setup']
        },
        {
          id: 'maintenance_schedule',
          title: 'Maintenance schedule established',
          description: 'Regular update schedule and communication preferences set',
          category: 'admin',
          order_index: 5,
          is_required: true,
          estimated_time_minutes: 30
        }
      ]
    }
  ];

  // Create onboarding project from signed contract
  async createOnboardingProject(clientId: string, projectType: string, customRequirements?: string[]): Promise<string> {
    try {
      // Find appropriate template
      const template = this.templates.find(t => t.project_type === projectType) || this.templates[0];

      // Create onboarding project
      const { data: project, error: projectError } = await this.supabase
        .from('onboarding_projects')
        .insert({
          client_id: clientId,
          project_type: projectType,
          template_id: template.id,
          status: 'active',
          estimated_completion_date: this.calculateEstimatedCompletion(template.tasks),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (projectError) {
        console.error('Error creating onboarding project:', projectError);
        throw projectError;
      }

      // Create individual tasks
      const tasksToCreate = template.tasks.map(task => ({
        project_id: project.id,
        task_id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        order_index: task.order_index,
        is_required: task.is_required,
        estimated_time_minutes: task.estimated_time_minutes,
        depends_on: task.depends_on || [],
        status: 'pending',
        assigned_to: task.category === 'client' ? 'client' : 'admin'
      }));

      const { error: tasksError } = await this.supabase
        .from('onboarding_tasks')
        .insert(tasksToCreate);

      if (tasksError) {
        console.error('Error creating onboarding tasks:', tasksError);
        throw tasksError;
      }

      // Send welcome email with onboarding packet
      await this.sendOnboardingWelcome(clientId, project.id);

      // Update next available tasks
      await this.updateAvailableTasks(project.id);

      return project.id;

    } catch (error) {
      console.error('Error creating onboarding project:', error);
      throw error;
    }
  }

  private calculateEstimatedCompletion(tasks: OnboardingTask[]): string {
    const totalMinutes = tasks.reduce((sum, task) => sum + (task.estimated_time_minutes || 60), 0);
    const estimatedDays = Math.ceil(totalMinutes / 480); // 8 hours per day
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + estimatedDays);
    return completionDate.toISOString();
  }

  private async sendOnboardingWelcome(clientId: string, projectId: string): Promise<void> {
    // Get client details
    const { data: client } = await this.supabase
      .from('clients')
      .select('name, email')
      .eq('id', clientId)
      .single();

    if (!client) return;

    // Get client tasks
    const { data: clientTasks } = await this.supabase
      .from('onboarding_tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('assigned_to', 'client')
      .eq('status', 'pending')
      .order('order_index');

    const tasksList = clientTasks?.map(task =>
      `<li><strong>${task.title}</strong><br><span style="color: #666;">${task.description}</span></li>`
    ).join('') || '';

    await resend.emails.send({
      from: 'Reece at NunezDev <reece@nunezdev.com>',
      to: [client.email],
      subject: `Welcome to NunezDev! Let's get your project started`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #ffc312; margin: 0; font-size: 28px;">Welcome to NunezDev!</h1>
              <p style="color: #666; margin: 10px 0 0 0;">Let's get your project started</p>
            </div>

            <div style="margin: 20px 0;">
              <p>Hi ${client.name},</p>
              <p>Welcome to the NunezDev family! I'm excited to work with you on your project.</p>
              <p>I've created a custom onboarding checklist to ensure we have everything we need to deliver exceptional results. This process helps us stay organized and ensures nothing falls through the cracks.</p>
            </div>

            <div style="background-color: #e8f4f8; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #333; margin: 0 0 15px 0;">Your Action Items:</h3>
              <ul style="color: #666; margin: 0; padding-left: 20px;">
                ${tasksList}
              </ul>
            </div>

            <div style="margin: 20px 0;">
              <p><strong>What happens next?</strong></p>
              <ol style="color: #666;">
                <li>Complete the action items above at your convenience</li>
                <li>I'll reach out to schedule our kickoff call</li>
                <li>We'll review everything together and finalize the project timeline</li>
                <li>I'll get started on your amazing new website!</li>
              </ol>
            </div>

            <div style="background-color: #fff3cd; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;"><strong>Need help?</strong> Just reply to this email or call me directly. I'm here to make this process as smooth as possible!</p>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; margin: 0;">Looking forward to creating something amazing together!</p>
              <p style="color: #ffc312; font-weight: bold; margin: 10px 0 0 0;">Reece Nunez</p>
              <p style="color: #999; margin: 5px 0 0 0; font-size: 14px;">NunezDev • reece@nunezdev.com</p>
            </div>
          </div>
        </div>
      `
    });
  }

  // Mark task as completed
  async completeTask(projectId: string, taskId: string, completedBy: string, notes?: string): Promise<void> {
    await this.supabase
      .from('onboarding_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: completedBy,
        completion_notes: notes
      })
      .eq('project_id', projectId)
      .eq('task_id', taskId);

    // Update available tasks
    await this.updateAvailableTasks(projectId);

    // Check if project is complete
    await this.checkProjectCompletion(projectId);

    // Send progress update
    await this.sendProgressUpdate(projectId);
  }

  private async updateAvailableTasks(projectId: string): Promise<void> {
    // Get all tasks for project
    const { data: tasks } = await this.supabase
      .from('onboarding_tasks')
      .select('*')
      .eq('project_id', projectId);

    if (!tasks) return;

    // Find tasks that can now be started
    const completedTaskIds = tasks.filter(t => t.status === 'completed').map(t => t.task_id);

    for (const task of tasks) {
      if (task.status === 'pending' && task.depends_on) {
        const dependenciesMet = task.depends_on.every(depId => completedTaskIds.includes(depId));

        if (dependenciesMet) {
          await this.supabase
            .from('onboarding_tasks')
            .update({ status: 'available' })
            .eq('project_id', projectId)
            .eq('task_id', task.task_id);
        }
      } else if (task.status === 'pending' && !task.depends_on) {
        // Tasks with no dependencies are immediately available
        await this.supabase
          .from('onboarding_tasks')
          .update({ status: 'available' })
          .eq('project_id', projectId)
          .eq('task_id', task.task_id);
      }
    }
  }

  private async checkProjectCompletion(projectId: string): Promise<void> {
    const { data: incompleteTasks } = await this.supabase
      .from('onboarding_tasks')
      .select('id')
      .eq('project_id', projectId)
      .neq('status', 'completed')
      .eq('is_required', true);

    if (!incompleteTasks || incompleteTasks.length === 0) {
      // All required tasks completed - mark project as complete
      await this.supabase
        .from('onboarding_projects')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', projectId);

      await this.sendProjectCompletionNotification(projectId);
    }
  }

  private async sendProgressUpdate(projectId: string): Promise<void> {
    // Get project and client info
    const { data: project } = await this.supabase
      .from('onboarding_projects')
      .select(`
        *,
        clients (name, email)
      `)
      .eq('id', projectId)
      .single();

    if (!project) return;

    // Get task completion stats
    const { data: allTasks } = await this.supabase
      .from('onboarding_tasks')
      .select('status, is_required')
      .eq('project_id', projectId);

    const totalRequired = allTasks?.filter(t => t.is_required).length || 0;
    const completedRequired = allTasks?.filter(t => t.is_required && t.status === 'completed').length || 0;
    const progressPercent = Math.round((completedRequired / totalRequired) * 100);

    // Only send updates at meaningful milestones
    if (progressPercent % 25 !== 0) return;

    await resend.emails.send({
      from: 'Reece at NunezDev <reece@nunezdev.com>',
      to: [project.clients.email],
      subject: `Project Update: ${progressPercent}% Complete!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #ffc312;">Project Progress Update</h2>
          <p>Hi ${project.clients.name},</p>
          <p>Great news! Your project is now <strong>${progressPercent}% complete</strong>.</p>

          <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <div style="background-color: #ffc312; height: 20px; border-radius: 10px; width: 100%; position: relative;">
              <div style="background-color: #28a745; height: 100%; width: ${progressPercent}%; border-radius: 10px;"></div>
            </div>
            <p style="text-align: center; margin: 10px 0 0 0;"><strong>${completedRequired} of ${totalRequired} required tasks completed</strong></p>
          </div>

          <p>I'll continue working on the next phase and keep you updated on our progress.</p>
          <p>Thanks for your partnership!</p>
          <p>Reece</p>
        </div>
      `
    });
  }

  private async sendProjectCompletionNotification(projectId: string): Promise<void> {
    const { data: project } = await this.supabase
      .from('onboarding_projects')
      .select(`
        *,
        clients (name, email)
      `)
      .eq('id', projectId)
      .single();

    if (!project) return;

    await resend.emails.send({
      from: 'Reece at NunezDev <reece@nunezdev.com>',
      to: [project.clients.email],
      subject: `🎉 Project Complete! Welcome to the NunezDev family`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ffc312; font-size: 32px;">🎉 Project Complete!</h1>
          </div>

          <p>Hi ${project.clients.name},</p>
          <p>Congratulations! Your project onboarding is now complete and your website is live!</p>

          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #155724; margin: 0 0 10px 0;">What's next?</h3>
            <ul style="color: #155724; margin: 0;">
              <li>Your website is now live and optimized</li>
              <li>All analytics and monitoring tools are active</li>
              <li>You have access to your admin dashboard</li>
              <li>Ongoing support is available whenever you need it</li>
            </ul>
          </div>

          <p>Thank you for trusting NunezDev with your project. I'm here for any questions or future needs!</p>
          <p>Best regards,<br>Reece Nunez</p>
        </div>
      `
    });
  }

  // Get onboarding project dashboard data
  async getProjectDashboard(projectId: string): Promise<any> {
    const { data: project, error } = await this.supabase
      .from('onboarding_projects')
      .select(`
        *,
        clients (name, email),
        onboarding_tasks (*)
      `)
      .eq('id', projectId)
      .single();

    if (error) {
      throw error;
    }

    const tasks = project.onboarding_tasks || [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const availableTasks = tasks.filter(t => t.status === 'available').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;

    return {
      project: {
        ...project,
        progress: {
          total: totalTasks,
          completed: completedTasks,
          available: availableTasks,
          pending: pendingTasks,
          percent: Math.round((completedTasks / totalTasks) * 100)
        }
      },
      tasks: tasks.sort((a, b) => a.order_index - b.order_index)
    };
  }
}

export const clientOnboardingService = new ClientOnboardingService();