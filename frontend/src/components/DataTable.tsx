import type { ReactNode } from 'react';
import { EmptyState } from './State';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  data,
}: {
  columns: Array<Column<T>>;
  data: T[];
}) {
  if (data.length === 0) return <EmptyState />;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
