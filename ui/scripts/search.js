/**
 * Client-Side Search and Tab Filtering Controller
 */
class SearchEngine {
  constructor() {
    this.currentQuery = '';
    this.currentFilter = 'all';
  }

  setFilter(filter) {
    this.currentFilter = filter;
  }

  setQuery(query) {
    this.currentQuery = query.trim().toLowerCase();
  }

  apply(items) {
    let result = items;

    // 1. Filter by category tab
    if (this.currentFilter !== 'all') {
      if (this.currentFilter === 'pinned') {
        result = result.filter(i => i.pinned);
      } else if (this.currentFilter === 'text') {
        result = result.filter(i => i.type === 'text');
      } else if (this.currentFilter === 'image') {
        result = result.filter(i => i.type === 'image');
      } else if (this.currentFilter === 'url') {
        result = result.filter(i => i.subtype === 'url');
      }
    }

    // 2. Filter by search query
    if (this.currentQuery) {
      result = result.filter(item => {
        if (item.type === 'text') {
          return (
            (item.content && item.content.toLowerCase().includes(this.currentQuery)) ||
            (item.subtype && item.subtype.toLowerCase().includes(this.currentQuery))
          );
        } else if (item.type === 'image') {
          return (
            item.preview.toLowerCase().includes(this.currentQuery) ||
            item.subtype.toLowerCase().includes(this.currentQuery)
          );
        }
        return false;
      });
    }

    return result;
  }
}

window.SearchEngine = SearchEngine;
