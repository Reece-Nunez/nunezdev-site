import { NextRequest, NextResponse } from 'next/server';
import { clientOnboardingService } from '@/lib/clientOnboarding';

// Create new onboarding project
export async function POST(request: NextRequest) {
  try {
    const { clientId, projectType, customRequirements } = await request.json();

    if (!clientId || !projectType) {
      return NextResponse.json(
        { error: 'Client ID and project type are required' },
        { status: 400 }
      );
    }

    const projectId = await clientOnboardingService.createOnboardingProject(
      clientId,
      projectType,
      customRequirements
    );

    return NextResponse.json({
      success: true,
      projectId,
      message: 'Onboarding project created successfully'
    });

  } catch (error: any) {
    console.error('Error creating onboarding project:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create onboarding project' },
      { status: 500 }
    );
  }
}

// Get onboarding project dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const dashboard = await clientOnboardingService.getProjectDashboard(projectId);

    return NextResponse.json(dashboard);

  } catch (error: any) {
    console.error('Error fetching onboarding dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}