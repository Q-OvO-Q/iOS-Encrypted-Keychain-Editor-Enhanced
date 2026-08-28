import { useTable } from 'react-table';
import { KeychainItem, UndecryptableKeychainItem } from './Keychain';

type TableProps = {
  data: KeychainItem[];
  count: number;
  undecryptable: UndecryptableKeychainItem[];
  deletedItems: string[];
  markDeleted: (persistrefs: string[], deleted: boolean) => void;
  openModal: (arg0: KeychainItem) => void;
};

const columns = [
  {
    Header: 'Persistent Reference',
    accessor: 'persistref',
  },
  {
    Header: 'Group',
    accessor: 'agrp',
  },
  {
    Header: 'Label',
    accessor: 'labl',
  },
  {
    Header: 'Creation Date',
    accessor: 'cdat',
  },
  {
    Header: 'Modification Date',
    accessor: 'mdat',
  },
];

function Table({ data, count, undecryptable, deletedItems, markDeleted, openModal }: TableProps) {
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable<KeychainItem>({
    columns,
    data,
  });

  const deleted = new Set(deletedItems);
  const undecryptableRefs = undecryptable.map(item => item.persistref);
  const remainingCount = undecryptableRefs.filter(persistref => !deleted.has(persistref)).length;
  const deletedCount = undecryptable.length - remainingCount;
  const deletedEditableCount = data.filter(item => deleted.has(item.persistref)).length;

  return (
    <>
      <span className="editable-count px-2">
        {data.length} editable out of {count}
        {deletedEditableCount > 0 && <span className="text-danger"> – {deletedEditableCount} marked for deletion</span>}
        {undecryptable.length > 0 && (
          <button onClick={() => markDeleted(undecryptableRefs, true)} type="button" className="btn btn-outline-danger btn-sm ms-2" disabled={remainingCount === 0}>
            Delete Non-Editable ({remainingCount})
          </button>
        )}
      </span>

      <table {...getTableProps()} className="table">
        <thead>
          {headerGroups.map(headerGroup => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <th {...column.getHeaderProps()}>{column.render('Header')}</th>
              ))}
              <th></th>
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {rows.map((row, index) => {
            prepareRow(row);
            const item = data[index];
            const isDeleted = deleted.has(item.persistref);
            return (
              <tr {...row.getRowProps()} className={isDeleted ? 'deleted' : ''}>
                {row.cells.map(cell => {
                  return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>;
                })}
                <td align="right">
                  <button onClick={() => openModal(item)} type="button" className="btn btn-primary" disabled={isDeleted}>
                    Edit
                  </button>
                  &nbsp;
                  <button onClick={() => markDeleted([item.persistref], !isDeleted)} type="button" className={'btn ' + (isDeleted ? 'btn-secondary' : 'btn-danger')}>
                    {isDeleted ? 'Undo' : 'Delete'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {undecryptable.length > 0 && (
        <div className="non-editable">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              Non-Editable Items ({undecryptable.length}){deletedCount > 0 && <span className="text-danger"> – {deletedCount} marked for deletion</span>}
            </h5>
            {deletedCount > 0 && (
              <button onClick={() => markDeleted(undecryptableRefs, false)} type="button" className="btn btn-secondary btn-sm">
                Restore All
              </button>
            )}
          </div>
          <p className="text-muted mt-2">
            These items are protected by a <code>ThisDeviceOnly</code> class key which is wrapped with the hardware <code>0x835</code> key of the original device, so they cannot be
            decrypted with the backup password. Deleting them removes them from the downloaded Keychain backup, the backup itself is left untouched.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Persistent Reference</th>
                <th>Protection Class</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {undecryptable.map(item => (
                <tr key={item.persistref} className={deleted.has(item.persistref) ? 'deleted' : ''}>
                  <td>{item.persistref}</td>
                  <td>{item.protectionClass || 'Unknown'}</td>
                  <td align="right">
                    <button
                      onClick={() => markDeleted([item.persistref], !deleted.has(item.persistref))}
                      type="button"
                      className={'btn ' + (deleted.has(item.persistref) ? 'btn-secondary' : 'btn-danger')}
                    >
                      {deleted.has(item.persistref) ? 'Undo' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default Table;
