import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchState {
  term: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  matches: SearchMatch[];
  index: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearch: (term: string, opts?: { caseSensitive?: boolean; wholeWord?: boolean }) => ReturnType;
      clearSearch: () => ReturnType;
      findNext: () => ReturnType;
      findPrev: () => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
    };
  }
}

export const searchKey = new PluginKey<SearchState>('searchReplace');

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Find all matches inside text blocks (matches never span across blocks). */
function findMatches(doc: PMNode, term: string, caseSensitive: boolean, wholeWord: boolean): SearchMatch[] {
  if (!term) return [];
  const flags = caseSensitive ? 'g' : 'gi';
  const src = wholeWord ? `(?<![\\p{L}\\p{N}_])${escapeRe(term)}(?![\\p{L}\\p{N}_])` : escapeRe(term);
  const re = new RegExp(src, flags + 'u');
  const out: SearchMatch[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Build the block's text with a position map (inline non-text nodes become a placeholder char)
    let text = '';
    const map: number[] = [];
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) {
          text += child.text![i];
          map.push(start + i);
        }
      } else {
        text += '\uFFFC';
        map.push(start);
      }
    });
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      out.push({ from: map[m.index], to: map[m.index + m[0].length - 1] + 1 });
    }
    return false;
  });
  return out;
}

const empty: SearchState = { term: '', caseSensitive: false, wholeWord: false, matches: [], index: -1 };

/** Word/Writer-style Find & Replace with highlighted matches. */
export const SearchReplace = Extension.create({
  name: 'searchReplace',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => empty,
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
            if (!meta && !tr.docChanged) return prev;
            const next = { ...prev, ...(meta || {}) };
            if (!next.term) return empty;
            if (tr.docChanged || meta?.term !== undefined || meta?.caseSensitive !== undefined || meta?.wholeWord !== undefined) {
              next.matches = findMatches(newState.doc, next.term, next.caseSensitive, next.wholeWord);
              if (meta?.index === undefined) {
                // Keep the current match close to the cursor
                const head = newState.selection.from;
                const i = next.matches.findIndex((m) => m.to >= head);
                next.index = next.matches.length ? (i === -1 ? 0 : i) : -1;
              }
            }
            if (next.index >= next.matches.length) next.index = next.matches.length ? 0 : -1;
            return next;
          }
        },
        props: {
          decorations(state) {
            const s = searchKey.getState(state);
            if (!s || !s.matches.length) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) =>
                Decoration.inline(m.from, m.to, { class: i === s.index ? 'search-match search-match-current' : 'search-match' })
              )
            );
          }
        }
      })
    ];
  },

  addCommands() {
    const goTo =
      (dir: 1 | -1) =>
      () =>
      ({ state, dispatch, view }: any) => {
        const s = searchKey.getState(state);
        if (!s || !s.matches.length) return false;
        const index = (s.index + dir + s.matches.length) % s.matches.length;
        if (dispatch) {
          dispatch(state.tr.setMeta(searchKey, { index }));
          const m = s.matches[index];
          const dom = view.domAtPos(m.from)?.node as HTMLElement | undefined;
          const el = dom && (dom.nodeType === 3 ? dom.parentElement : dom);
          el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        }
        return true;
      };

    return {
      setSearch:
        (term, opts = {}) =>
        ({ state, dispatch }) => {
          if (dispatch)
            dispatch(
              state.tr.setMeta(searchKey, {
                term,
                caseSensitive: !!opts.caseSensitive,
                wholeWord: !!opts.wholeWord
              })
            );
          return true;
        },
      clearSearch:
        () =>
        ({ state, dispatch }) => {
          if (dispatch) dispatch(state.tr.setMeta(searchKey, { term: '' }));
          return true;
        },
      findNext: goTo(1),
      findPrev: goTo(-1),
      replaceCurrent:
        (replacement) =>
        ({ state, dispatch }) => {
          const s = searchKey.getState(state);
          if (!s || s.index < 0) return false;
          const m = s.matches[s.index];
          if (dispatch) {
            const tr = state.tr;
            if (replacement) tr.insertText(replacement, m.from, m.to);
            else tr.delete(m.from, m.to);
            // Stay on the same index → effectively moves to the next match
            tr.setMeta(searchKey, { index: s.index });
            dispatch(tr);
          }
          return true;
        },
      replaceAll:
        (replacement) =>
        ({ state, dispatch }) => {
          const s = searchKey.getState(state);
          if (!s || !s.matches.length) return false;
          if (dispatch) {
            const tr = state.tr;
            // Replace from the end so earlier positions stay valid
            for (let i = s.matches.length - 1; i >= 0; i--) {
              const m = s.matches[i];
              if (replacement) tr.insertText(replacement, m.from, m.to);
              else tr.delete(m.from, m.to);
            }
            dispatch(tr);
          }
          return true;
        }
    };
  }
});
