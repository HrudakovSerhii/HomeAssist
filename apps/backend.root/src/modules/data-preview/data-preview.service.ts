import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProcessedEmailsQueryDto } from './dto/extracted-data-query.dto';

@Injectable()
export class DataPreviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getProcessedEmailData(queryDto: ProcessedEmailsQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      priority,
      sentiment,
      entityType,
      actionType,
      dateFrom,
      dateTo,
      minConfidence,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ProcessedEmailsWhereInput = {};

    // Search in email subject and summary
    if (search) {
      where.OR = [
        {
          subject: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          summary: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Filter by category
    if (category) {
      where.category = category;
    }

    // Filter by priority
    if (priority) {
      where.priority = priority;
    }

    // Filter by sentiment
    if (sentiment) {
      where.sentiment = sentiment;
    }

    // Filter by entity type
    if (entityType) {
      where.entities = {
        some: {
          entityType: entityType,
        },
      };
    }

    // Filter by action type
    if (actionType) {
      where.actionItems = {
        some: {
          actionType: actionType,
        },
      };
    }

    // Filter by confidence
    if (minConfidence !== undefined) {
      where.confidence = {
        gte: minConfidence,
      };
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      where.receivedAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    // Build orderBy clause
    let orderBy: Prisma.ProcessedEmailsOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await Promise.all([
      this.prisma.processedEmails.findMany({
        where,
        select: {
          id: true,
          subject: true,
          fromAddress: true,
          receivedAt: true,
          category: true,
          priority: true,
          sentiment: true,
          summary: true,
          tags: true,
          confidence: true,
          processingStatus: true,
          entities: {
            select: {
              id: true,
              entityType: true,
              entityValue: true,
              confidence: true,
            },
            orderBy: {
              confidence: 'desc',
            },
          },
          actionItems: {
            select: {
              id: true,
              description: true,
              actionType: true,
              priority: true,
              isCompleted: true,
            },
            orderBy: {
              priority: 'desc',
            },
          },
        },
        orderBy,
        take: limit,
        skip,
      }),
      this.prisma.processedEmails.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
              filters: {
          search,
          category,
          priority,
          sentiment,
          entityType,
          actionType,
          dateFrom,
          dateTo,
          minConfidence,
          sortBy,
          sortOrder,
        },
    };
  }

  // Additional method for getting filter options (for frontend dropdowns)
  async getFilterOptions() {
    const [categories, priorities, sentiments, entityTypes, actionTypes] = await Promise.all([
      this.prisma.processedEmails.findMany({
        select: { category: true },
        distinct: ['category'],
      }),
      this.prisma.processedEmails.findMany({
        select: { priority: true },
        distinct: ['priority'],
      }),
      this.prisma.processedEmails.findMany({
        select: { sentiment: true },
        distinct: ['sentiment'],
      }),
      this.prisma.entityExtraction.findMany({
        select: { entityType: true },
        distinct: ['entityType'],
      }),
      this.prisma.actionItem.findMany({
        select: { actionType: true },
        distinct: ['actionType'],
      }),
    ]);

    return {
      categories: categories.map(c => c.category),
      priorities: priorities.map(p => p.priority),
      sentiments: sentiments.map(s => s.sentiment),
      entityTypes: entityTypes.map(e => e.entityType),
      actionTypes: actionTypes.map(a => a.actionType),
    };
  }
} 