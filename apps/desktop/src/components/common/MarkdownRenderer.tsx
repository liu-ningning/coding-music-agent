import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import s from '@/styles/markdown.module.css';

interface MarkdownRendererProps {
  content: string;
}

/**
 * Markdown 渲染组件
 * 支持 GFM 语法：表格、任务列表、删除线、自动链接等
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className={s.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
