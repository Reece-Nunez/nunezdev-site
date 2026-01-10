// Google Tasks Service
// Sync onboarding tasks with Google Tasks

import { googleServiceFactory } from './googleServiceFactory';
import type { GoogleTask, TaskList, TaskSyncResult } from './types';

// Default task list name for NunezDev projects
const NUNEZDEV_TASK_LIST_PREFIX = 'NunezDev:';

class TasksService {
  private static instance: TasksService;
  private defaultTaskListId: string | null = null;

  static getInstance(): TasksService {
    if (!TasksService.instance) {
      TasksService.instance = new TasksService();
    }
    return TasksService.instance;
  }

  private async getClient() {
    return googleServiceFactory.getTasksClient();
  }

  /**
   * Get or create the default NunezDev task list
   */
  async getDefaultTaskList(): Promise<string | null> {
    if (this.defaultTaskListId) {
      return this.defaultTaskListId;
    }

    const list = await this.findOrCreateTaskList('NunezDev Tasks');
    this.defaultTaskListId = list?.id || null;
    return this.defaultTaskListId;
  }

  /**
   * List all task lists
   */
  async listTaskLists(): Promise<TaskList[]> {
    try {
      const tasks = await this.getClient();
      if (!tasks) return [];

      const response = await tasks.tasklists.list({
        maxResults: 100,
      });

      return (response.data.items || []) as TaskList[];
    } catch (error: any) {
      console.error('Failed to list task lists:', error.message);
      return [];
    }
  }

  /**
   * Find a task list by title
   */
  async findTaskList(title: string): Promise<TaskList | null> {
    const lists = await this.listTaskLists();
    return lists.find((l) => l.title === title) || null;
  }

  /**
   * Create a new task list
   */
  async createTaskList(title: string): Promise<TaskList | null> {
    try {
      const tasks = await this.getClient();
      if (!tasks) return null;

      const response = await tasks.tasklists.insert({
        requestBody: { title },
      });

      console.log(`Created task list: ${title}`);
      return response.data as TaskList;
    } catch (error: any) {
      console.error('Failed to create task list:', error.message);
      return null;
    }
  }

  /**
   * Find or create a task list
   */
  async findOrCreateTaskList(title: string): Promise<TaskList | null> {
    const existing = await this.findTaskList(title);
    if (existing) return existing;
    return this.createTaskList(title);
  }

  /**
   * Get or create a project-specific task list
   */
  async getProjectTaskList(projectName: string): Promise<string | null> {
    const title = `${NUNEZDEV_TASK_LIST_PREFIX} ${projectName}`;
    const list = await this.findOrCreateTaskList(title);
    return list?.id || null;
  }

  /**
   * Create a new task
   */
  async createTask(
    taskListId: string,
    title: string,
    notes?: string,
    due?: Date,
    parentTaskId?: string
  ): Promise<TaskSyncResult> {
    try {
      const tasks = await this.getClient();
      if (!tasks) {
        return { success: false, error: 'Google Tasks not available' };
      }

      const taskResource: any = {
        title,
        status: 'needsAction',
      };

      if (notes) {
        taskResource.notes = notes;
      }

      if (due) {
        // Google Tasks requires RFC 3339 date format
        taskResource.due = due.toISOString();
      }

      const params: any = {
        tasklist: taskListId,
        requestBody: taskResource,
      };

      if (parentTaskId) {
        params.parent = parentTaskId;
      }

      const response = await tasks.tasks.insert(params);

      console.log(`Created task: ${title}`);

      return {
        success: true,
        taskId: response.data.id,
        etag: response.data.etag,
      };
    } catch (error: any) {
      console.error('Failed to create task:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a task
   */
  async updateTask(
    taskListId: string,
    taskId: string,
    updates: {
      title?: string;
      notes?: string;
      due?: Date | null;
      status?: 'needsAction' | 'completed';
    }
  ): Promise<TaskSyncResult> {
    try {
      const tasks = await this.getClient();
      if (!tasks) {
        return { success: false, error: 'Google Tasks not available' };
      }

      const taskResource: any = {};

      if (updates.title !== undefined) {
        taskResource.title = updates.title;
      }

      if (updates.notes !== undefined) {
        taskResource.notes = updates.notes;
      }

      if (updates.due !== undefined) {
        taskResource.due = updates.due ? updates.due.toISOString() : null;
      }

      if (updates.status !== undefined) {
        taskResource.status = updates.status;
        if (updates.status === 'completed') {
          taskResource.completed = new Date().toISOString();
        }
      }

      const response = await tasks.tasks.patch({
        tasklist: taskListId,
        task: taskId,
        requestBody: taskResource,
      });

      console.log(`Updated task: ${taskId}`);

      return {
        success: true,
        taskId: response.data.id,
        etag: response.data.etag,
      };
    } catch (error: any) {
      console.error('Failed to update task:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Complete a task
   */
  async completeTask(taskListId: string, taskId: string): Promise<TaskSyncResult> {
    return this.updateTask(taskListId, taskId, { status: 'completed' });
  }

  /**
   * Uncomplete a task (mark as needs action)
   */
  async uncompleteTask(taskListId: string, taskId: string): Promise<TaskSyncResult> {
    return this.updateTask(taskListId, taskId, { status: 'needsAction' });
  }

  /**
   * Delete a task
   */
  async deleteTask(taskListId: string, taskId: string): Promise<boolean> {
    try {
      const tasks = await this.getClient();
      if (!tasks) return false;

      await tasks.tasks.delete({
        tasklist: taskListId,
        task: taskId,
      });

      console.log(`Deleted task: ${taskId}`);
      return true;
    } catch (error: any) {
      console.error('Failed to delete task:', error.message);
      return false;
    }
  }

  /**
   * Get a single task
   */
  async getTask(taskListId: string, taskId: string): Promise<GoogleTask | null> {
    try {
      const tasks = await this.getClient();
      if (!tasks) return null;

      const response = await tasks.tasks.get({
        tasklist: taskListId,
        task: taskId,
      });

      return response.data as GoogleTask;
    } catch (error: any) {
      console.error('Failed to get task:', error.message);
      return null;
    }
  }

  /**
   * List all tasks in a task list
   */
  async listTasks(
    taskListId: string,
    options: {
      showCompleted?: boolean;
      showHidden?: boolean;
      maxResults?: number;
      pageToken?: string;
    } = {}
  ): Promise<{
    tasks: GoogleTask[];
    nextPageToken?: string;
  }> {
    try {
      const tasks = await this.getClient();
      if (!tasks) {
        return { tasks: [] };
      }

      const response = await tasks.tasks.list({
        tasklist: taskListId,
        showCompleted: options.showCompleted !== false,
        showHidden: options.showHidden || false,
        maxResults: options.maxResults || 100,
        pageToken: options.pageToken,
      });

      return {
        tasks: (response.data.items || []) as GoogleTask[],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error: any) {
      console.error('Failed to list tasks:', error.message);
      return { tasks: [] };
    }
  }

  /**
   * Move a task to a different position or parent
   */
  async moveTask(
    taskListId: string,
    taskId: string,
    options: {
      parent?: string;
      previous?: string;
    } = {}
  ): Promise<GoogleTask | null> {
    try {
      const tasks = await this.getClient();
      if (!tasks) return null;

      const response = await tasks.tasks.move({
        tasklist: taskListId,
        task: taskId,
        parent: options.parent,
        previous: options.previous,
      });

      return response.data as GoogleTask;
    } catch (error: any) {
      console.error('Failed to move task:', error.message);
      return null;
    }
  }

  /**
   * Clear completed tasks from a list
   */
  async clearCompletedTasks(taskListId: string): Promise<boolean> {
    try {
      const tasks = await this.getClient();
      if (!tasks) return false;

      await tasks.tasks.clear({
        tasklist: taskListId,
      });

      console.log(`Cleared completed tasks from list: ${taskListId}`);
      return true;
    } catch (error: any) {
      console.error('Failed to clear completed tasks:', error.message);
      return false;
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return googleServiceFactory.isAvailable();
  }
}

export const tasksService = TasksService.getInstance();
