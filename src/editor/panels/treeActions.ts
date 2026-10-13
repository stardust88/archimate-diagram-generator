// Model tree interactions (spec §9.3): context menu, drag to canvas, drag between folders.
import * as C from '../../core/commands/model-commands';
import { text } from '../../core/model/langstring';
import { useEditor } from '../../core/store/store';
import type { DefaultFolder } from '../../notation/archimate/folders';
import * as A from '../actions';
import { DND_REF, dropAt } from '../canvas/Canvas';
import { choiceMenu, promptDialog } from '../dialogs/dialogApi';
import { highlightInView, type TreeHandlers } from './ModelTree';
import { viewsContaining, type TreeNode } from './treeModel';

const MOVE_TYPE = 'application/x-archimate-move';

async function showInViews(id: string, at: { x: number; y: number }): Promise<void> {
  const m = useEditor.getState().model;
  if (!m) return;
  const views = viewsContaining(m, id);
  if (!views.length) {
    useEditor.getState().toast('Not shown in any view.');
    return;
  }
  const v = await choiceMenu({
    title: 'Show in view',
    at,
    options: views.map((vid) => ({
      value: vid,
      label: text(m.views[vid]!.name, m.primaryLang) || vid,
    })),
  });
  if (v) {
    useEditor.getState().openView(v);
    highlightInView(v, id);
  }
}

export const treeHandlers: TreeHandlers = {
  async onContextMenu(node: TreeNode, x: number, y: number) {
    const s = useEditor.getState();
    const m = s.model;
    if (!m || !node.id) return;
    const id = node.id;
    const at = { x, y };
    if (node.kind === 'view') {
      const c = await choiceMenu({
        title: node.label,
        at,
        options: [
          { value: 'open', label: 'Open' },
          { value: 'rename', label: 'Rename…' },
          { value: 'duplicate', label: 'Duplicate' },
          { value: 'delete', label: 'Delete view…' },
        ],
      });
      if (c === 'open') s.openView(id);
      else if (c === 'rename') await A.renameView(id);
      else if (c === 'duplicate') A.duplicateView(id);
      else if (c === 'delete') await A.deleteView(id);
      return;
    }
    if (node.kind !== 'element' && node.kind !== 'relation') return;
    const options = [
      { value: 'rename', label: 'Rename…' },
      { value: 'views', label: 'Show in views…' },
      ...(node.kind === 'element' && s.activeView
        ? [{ value: 'add', label: 'Add to current view' }]
        : []),
      { value: 'delete', label: 'Delete from model…' },
    ];
    const c = await choiceMenu({ title: node.label, at, options });
    if (c === 'rename') {
      const o = m.elements[id] ?? m.relations[id];
      const name = await promptDialog({
        title: 'Rename',
        label: 'Name',
        initial: text(o?.name, m.primaryLang),
        confirmLabel: 'Rename',
      });
      if (name !== null)
        s.dispatch(
          C.rename({ kind: m.elements[id] ? 'element' : 'relation', id }, m.primaryLang, name),
        );
    } else if (c === 'views') await showInViews(id, at);
    else if (c === 'add' && s.activeView) {
      const api = A.canvasApi();
      if (api) await dropAt(s.activeView, api.center(), { ref: id }, at);
    } else if (c === 'delete') await A.deleteFromModel([id]);
  },

  onDragStart(node, e) {
    if (!node.id) return;
    if (node.kind === 'element') e.dataTransfer.setData(DND_REF, node.id);
    e.dataTransfer.setData(MOVE_TYPE, node.id);
    e.dataTransfer.effectAllowed = 'copyMove';
  },

  onDropOnFolder(folder, e) {
    const id = e.dataTransfer.getData(MOVE_TYPE);
    if (!id) return;
    const target = folder.path ? { path: folder.path } : { name: folder.label as DefaultFolder };
    useEditor.getState().dispatch(C.moveToFolder(id, target));
  },
};
