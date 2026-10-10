import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  ScanCommandInput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Issue, CreateIssueInput, UpdateIssueInput, IssueStatus } from '../types/issue';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = process.env.TABLE_NAME || 'campuspulse-issues';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export async function createIssueInDB(
  input: CreateIssueInput,
  isDemoData = false
): Promise<Issue> {
  const now = new Date().toISOString();
  const issue: Issue = {
    id: uuidv4(),
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    location: input.location.trim(),
    priority: input.priority,
    status: 'open',
    reporterName: input.reporterName?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    isDemoData: isDemoData || undefined,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: issue,
      ConditionExpression: 'attribute_not_exists(id)',
    })
  );

  console.log(`[DB] Created issue ${issue.id}: "${issue.title}"`);
  return issue;
}

export async function getIssueFromDB(id: string): Promise<Issue | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { id },
    })
  );

  return (result.Item as Issue) || null;
}

export interface ListIssuesOptions {
  status?: IssueStatus;
  category?: string;
  priority?: string;
  limit?: number;
}

export async function listIssuesFromDB(options: ListIssuesOptions = {}): Promise<Issue[]> {
  const filterExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, string> = {};

  if (options.status) {
    filterExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = options.status;
  }

  if (options.category) {
    filterExpressions.push('#category = :category');
    expressionAttributeNames['#category'] = 'category';
    expressionAttributeValues[':category'] = options.category;
  }

  if (options.priority) {
    filterExpressions.push('#priority = :priority');
    expressionAttributeNames['#priority'] = 'priority';
    expressionAttributeValues[':priority'] = options.priority;
  }

  const params: ScanCommandInput = {
    TableName: TABLE_NAME,
    ...(filterExpressions.length > 0 && {
      FilterExpression: filterExpressions.join(' AND '),
    }),
    ...(Object.keys(expressionAttributeNames).length > 0 && {
      ExpressionAttributeNames: expressionAttributeNames,
    }),
    ...(Object.keys(expressionAttributeValues).length > 0 && {
      ExpressionAttributeValues: expressionAttributeValues,
    }),
  };

  const result = await docClient.send(new ScanCommand(params));
  const items = (result.Items as Issue[]) || [];

  // Sort by createdAt descending
  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function updateIssueInDB(
  id: string,
  update: UpdateIssueInput
): Promise<Issue | null> {
  const now = new Date().toISOString();

  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ConditionExpression: 'attribute_exists(id)',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': update.status,
          ':updatedAt': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    console.log(`[DB] Updated issue ${id} to status: ${update.status}`);
    return (result.Attributes as Issue) || null;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.name === 'ConditionalCheckFailedException'
    ) {
      return null; // Issue not found
    }
    throw err;
  }
}
