import { Folder } from '../models';
import { selectBreadcrumb, selectChildFolders } from './documents.selectors';

function makeFolder(id: string, name: string, parent: string | null): Folder {
  return { id, name, parent, created_at: '', updated_at: '' };
}

describe('documents selectors', () => {
  const root = makeFolder('a', 'Work', null);
  const child = makeFolder('b', 'Projects', 'a');
  const grandchild = makeFolder('c', 'Q1', 'b');
  const unrelated = makeFolder('d', 'Personal', null);
  const folders = [root, child, grandchild, unrelated];

  it('selectChildFolders returns only direct children of the current folder', () => {
    expect(selectChildFolders.projector(folders, 'a')).toEqual([child]);
    expect(selectChildFolders.projector(folders, null)).toEqual([root, unrelated]);
  });

  it('selectBreadcrumb walks from the current folder up to the root, in top-down order', () => {
    expect(selectBreadcrumb.projector(folders, 'c')).toEqual([root, child, grandchild]);
  });

  it('selectBreadcrumb is empty at the root', () => {
    expect(selectBreadcrumb.projector(folders, null)).toEqual([]);
  });

  it('selectBreadcrumb does not loop forever if a folder is somehow its own ancestor', () => {
    const cyclicA = makeFolder('x', 'X', 'y');
    const cyclicB = makeFolder('y', 'Y', 'x');
    const result = selectBreadcrumb.projector([cyclicA, cyclicB], 'x');
    // Whatever it returns, it must terminate - this test times out (hangs)
    // rather than fails if the walk regresses into an infinite loop.
    expect(result.length).toBeLessThanOrEqual(2);
  });
});
