import { NextRequest, NextResponse } from 'next/server';
import { clientOnboardingService } from '@/lib/clientOnboarding';

// Complete a task
export async function PATCH(request: NextRequest) {
  try {
    const { projectId, taskId, completedBy, notes } = await request.json();

    if (!projectId || !taskId || !completedBy) {
      return NextResponse.json(
        { error: 'Project ID, task ID, and completed by are required' },
        { status: 400 }
      );
    }

    await clientOnboardingService.completeTask(projectId, taskId, completedBy, notes);

    return NextResponse.json({
      success: true,
      message: 'Task completed successfully'
    });

  } catch (error: any) {
    console.error('Error completing task:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete task' },
      { status: 500 }
    );
  }
}