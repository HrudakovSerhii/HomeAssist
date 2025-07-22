import { PRIORITY_COLORS, SENTIMENT_COLORS, CATEGORY_COLORS } from './constants';

export const getPriorityColor = (priority: string): string => {
  const colorKey = priority.toLowerCase() as keyof typeof PRIORITY_COLORS;
  return PRIORITY_COLORS[colorKey] || PRIORITY_COLORS.default;
};

export const getSentimentColor = (sentiment: string): string => {
  const colorKey = sentiment.toLowerCase() as keyof typeof SENTIMENT_COLORS;
  return SENTIMENT_COLORS[colorKey] || SENTIMENT_COLORS.default;
};

export const getCategoryColor = (category: string): string => {
  const colorKey = category as keyof typeof CATEGORY_COLORS;
  return CATEGORY_COLORS[colorKey] || CATEGORY_COLORS.default;
}; 