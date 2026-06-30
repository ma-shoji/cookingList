// --- App State Management ---
let state = {
  selectedDays: [], // Array of day numbers, e.g. [1, 3]
  checkedIngredients: {}, // Map of ingredientName -> boolean
  currentTab: 'recipes',
  currentFilter: 'all'
};

// --- DOM Elements ---
const DOM = {
  tabButtons: document.querySelectorAll('.nav-item'),
  views: document.querySelectorAll('.app-view'),
  recipesList: document.getElementById('recipes-list'),
  filterChips: document.querySelectorAll('.filter-chip'),
  
  // Shopping view elements
  selectedRecipesCount: document.getElementById('selected-recipes-count'),
  shoppingList: document.getElementById('shopping-list'),
  shoppingListEmpty: document.getElementById('shopping-list-empty'),
  navBadgeCount: document.getElementById('nav-badge-count'),
  btnCopyList: document.getElementById('btn-copy-list'),
  btnResetChecked: document.getElementById('btn-reset-checked'),
  btnClearAll: document.getElementById('btn-clear-all'),
  
  // Cooking view elements
  cookingRecipesList: document.getElementById('cooking-recipes-list'),
  cookingListEmpty: document.getElementById('cooking-list-empty')
};

// --- Helper Functions ---
function saveState() {
  localStorage.setItem('cooking_app_state', JSON.stringify({
    selectedDays: state.selectedDays,
    checkedIngredients: state.checkedIngredients
  }));
}

function loadState() {
  const saved = localStorage.getItem('cooking_app_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.selectedDays = parsed.selectedDays || [];
      state.checkedIngredients = parsed.checkedIngredients || {};
    } catch (e) {
      console.error("Failed to parse saved state", e);
    }
  }
}

// Extract appliance tag from dish name, e.g., "無水肉じゃが（電気圧力鍋）" -> "電気圧力鍋"
function getApplianceTag(dishName) {
  if (!dishName) return null;
  const match = dishName.match(/[（(](電気圧力鍋|ノンフライヤー|レンジ|フライパン|ガスコンロ)[）)]/);
  return match ? match[1] : null;
}

// Get all tags for a day recipe
function getRecipeTags(recipe) {
  const tags = new Set();
  if (recipe.main && recipe.main.name) {
    const t = getApplianceTag(recipe.main.name);
    if (t) tags.add(t);
  }
  if (recipe.side && recipe.side.name) {
    const t = getApplianceTag(recipe.side.name);
    if (t) tags.add(t);
  }
  return Array.from(tags);
}

// --- Render Functions ---

// 1. Render Recipes Tab
function renderRecipes() {
  DOM.recipesList.innerHTML = '';
  
  RECIPES.forEach(recipe => {
    const tags = getRecipeTags(recipe);
    
    // Filter matching
    if (state.currentFilter !== 'all') {
      const displayFilter = state.currentFilter === '圧力鍋' ? '電気圧力鍋' : state.currentFilter;
      if (!tags.includes(displayFilter)) {
        return; // Skip if filter doesn't match
      }
    }
    
    const isSelected = state.selectedDays.includes(recipe.day);
    
    const card = document.createElement('div');
    card.className = `recipe-card ${isSelected ? 'selected' : ''}`;
    card.dataset.day = recipe.day;
    
    // Build tags HTML
    const tagsHtml = tags.map(tag => {
      let tagClass = 'tag';
      if (tag === '電気圧力鍋') tagClass += ' tag-pressure';
      else if (tag === 'ノンフライヤー') tagClass += ' tag-fryer';
      else if (tag === 'レンジ') tagClass += ' tag-range';
      else if (tag === 'フライパン' || tag === 'ガスコンロ') tagClass += ' tag-pan';
      
      const displayTag = tag === '電気圧力鍋' ? '電気圧力鍋' : tag;
      return `<span class="${tagClass}">${displayTag}</span>`;
    }).join('');
    
    card.innerHTML = `
      <div class="card-top">
        <span class="day-badge">${recipe.day}日目</span>
        <label class="recipe-checkbox-container" onclick="event.stopPropagation();">
          <input type="checkbox" ${isSelected ? 'checked' : ''} data-day="${recipe.day}">
          <span class="checkmark"></span>
        </label>
      </div>
      <h3 class="recipe-title">${recipe.title.replace(/【\d+日目】/, '')}</h3>
      <div class="dishes-preview">
        <div class="dish-preview-item">
          <span class="icon">🍳</span>
          <span class="name">主菜：${recipe.main ? recipe.main.name : 'なし'}</span>
        </div>
        ${recipe.side ? `
        <div class="dish-preview-item side-dish">
          <span class="icon">🥗</span>
          <span class="name">副菜：${recipe.side.name}</span>
        </div>
        ` : ''}
      </div>
      <div class="recipe-tags">
        ${tagsHtml}
      </div>
    `;
    
    // Toggle selection on card click
    card.addEventListener('click', () => {
      toggleRecipeSelection(recipe.day);
    });
    
    // Input checkbox click listener
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      toggleRecipeSelection(recipe.day);
    });
    
    DOM.recipesList.appendChild(card);
  });
  
  if (DOM.recipesList.children.length === 0) {
    DOM.recipesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>該当するレシピがありません</h3>
        <p>他の調理器具フィルターを選択してみてください。</p>
      </div>
    `;
  }
}

// Toggle selection
function toggleRecipeSelection(day) {
  const index = state.selectedDays.indexOf(day);
  if (index === -1) {
    state.selectedDays.push(day);
  } else {
    state.selectedDays.splice(index, 1);
  }
  
  // Sort days
  state.selectedDays.sort((a, b) => a - b);
  
  saveState();
  updateUI();
}

// 2. Render & Update Shopping List Tab
function updateShoppingList() {
  const selectedRecipes = RECIPES.filter(r => state.selectedDays.includes(r.day));
  
  // Update selected counts
  DOM.selectedRecipesCount.textContent = state.selectedDays.length;
  
  // Update badge count (number of selected days)
  if (state.selectedDays.length > 0) {
    DOM.navBadgeCount.textContent = state.selectedDays.length;
    DOM.navBadgeCount.classList.add('visible');
  } else {
    DOM.navBadgeCount.classList.remove('visible');
  }
  
  if (selectedRecipes.length === 0) {
    DOM.shoppingListEmpty.style.display = 'flex';
    DOM.shoppingList.style.display = 'none';
    DOM.shoppingList.innerHTML = '';
    return;
  }
  
  DOM.shoppingListEmpty.style.display = 'none';
  DOM.shoppingList.style.display = 'flex';
  
  // Merge ingredients
  const mergedIngredients = {};
  
  selectedRecipes.forEach(recipe => {
    recipe.shopping.forEach(item => {
      const name = item.name.trim();
      const amount = item.amount.trim();
      
      if (!mergedIngredients[name]) {
        mergedIngredients[name] = [];
      }
      mergedIngredients[name].push({
        amount: amount,
        day: recipe.day
      });
    });
  });
  
  DOM.shoppingList.innerHTML = '';
  
  Object.keys(mergedIngredients).forEach(name => {
    const details = mergedIngredients[name];
    
    // Create clean amount display
    // e.g. "1個 (1日目), 1/2個 (5日目)"
    const amountStr = details.map(d => `${d.amount} (${d.day}日目)`).join(', ');
    
    const isChecked = !!state.checkedIngredients[name];
    
    const li = document.createElement('li');
    li.className = `shopping-item ${isChecked ? 'checked' : ''}`;
    
    li.innerHTML = `
      <div class="shopping-item-left">
        <div class="shopping-item-checkbox"></div>
        <span class="shopping-item-name">${name}</span>
      </div>
      <span class="shopping-item-amount">${amountStr}</span>
    `;
    
    li.addEventListener('click', () => {
      state.checkedIngredients[name] = !state.checkedIngredients[name];
      if (!state.checkedIngredients[name]) {
        delete state.checkedIngredients[name]; // Clean up memory if false
      }
      saveState();
      li.classList.toggle('checked');
    });
    
    DOM.shoppingList.appendChild(li);
  });
}

// 3. Render Cooking Instructions Tab
function renderCookingInstructions() {
  const selectedRecipes = RECIPES.filter(r => state.selectedDays.includes(r.day));
  
  if (selectedRecipes.length === 0) {
    DOM.cookingListEmpty.style.display = 'flex';
    DOM.cookingRecipesList.style.display = 'none';
    DOM.cookingRecipesList.innerHTML = '';
    return;
  }
  
  DOM.cookingListEmpty.style.display = 'none';
  DOM.cookingRecipesList.style.display = 'flex';
  DOM.cookingRecipesList.innerHTML = '';
  
  selectedRecipes.forEach((recipe, idx) => {
    const card = document.createElement('div');
    // First card expanded by default
    const isExpanded = idx === 0;
    card.className = `cooking-card ${isExpanded ? 'expanded' : ''}`;
    
    card.innerHTML = `
      <div class="cooking-card-header">
        <h3>${recipe.title}</h3>
        <span class="toggle-arrow">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
          </svg>
        </span>
      </div>
      <div class="cooking-card-body">
        <!-- Main Dish -->
        ${recipe.main ? `
        <div class="dish-section">
          <h4>主菜：${recipe.main.name}</h4>
          <div class="dish-ingredients">
            <strong>【材料】</strong> ${recipe.main.ingredients}
          </div>
          <div class="dish-steps">
            ${recipe.main.steps.map((step, sIdx) => `
              <div class="step-item">
                <span class="step-num">${sIdx + 1}</span>
                <span class="step-text">${step}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        <!-- Side Dish -->
        ${recipe.side ? `
        <div class="dish-section">
          <h4>副菜：${recipe.side.name}</h4>
          <div class="dish-ingredients">
            <strong>【材料】</strong> ${recipe.side.ingredients}
          </div>
          <div class="dish-steps">
            ${recipe.side.steps.map((step, sIdx) => `
              <div class="step-item">
                <span class="step-num">${sIdx + 1}</span>
                <span class="step-text">${step}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    `;
    
    // Toggle collapse/expand
    const header = card.querySelector('.cooking-card-header');
    header.addEventListener('click', () => {
      card.classList.toggle('expanded');
    });
    
    DOM.cookingRecipesList.appendChild(card);
  });
}

// Update all components in UI based on state
function updateUI() {
  renderRecipes();
  updateShoppingList();
  renderCookingInstructions();
}

// --- Event Handlers & Navigation ---

function initNavigation() {
  DOM.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      
      // Update active nav item
      DOM.tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update active view
      DOM.views.forEach(view => {
        view.classList.remove('active');
        if (view.id === `view-${tab}`) {
          view.classList.add('active');
        }
      });
      
      state.currentTab = tab;
      
      // iOS bounce layout trick: scroll to top on tab switch
      window.scrollTo(0, 0);
    });
  });
}

function initFilters() {
  DOM.filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      DOM.filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      
      state.currentFilter = chip.dataset.filter;
      renderRecipes();
    });
  });
}

function initActionButtons() {
  // Clear all selections
  const clearAction = () => {
    if (confirm('すべての選択を解除しますか？')) {
      state.selectedDays = [];
      state.checkedIngredients = {};
      saveState();
      updateUI();
    }
  };
  DOM.btnClearAll.addEventListener('click', clearAction);
  
  // Reset checked shopping items
  DOM.btnResetChecked.addEventListener('click', () => {
    state.checkedIngredients = {};
    saveState();
    updateShoppingList();
  });
  
  // Copy shopping list to clipboard
  DOM.btnCopyList.addEventListener('click', () => {
    const selectedRecipes = RECIPES.filter(r => state.selectedDays.includes(r.day));
    if (selectedRecipes.length === 0) return;
    
    // Merge ingredients to build copy text
    const mergedIngredients = {};
    selectedRecipes.forEach(recipe => {
      recipe.shopping.forEach(item => {
        const name = item.name.trim();
        const amount = item.amount.trim();
        if (!mergedIngredients[name]) {
          mergedIngredients[name] = [];
        }
        mergedIngredients[name].push({ amount, day: recipe.day });
      });
    });
    
    let copyText = `🛒 【買い物リスト】\n`;
    Object.keys(mergedIngredients).forEach(name => {
      const amounts = mergedIngredients[name];
      const isChecked = !!state.checkedIngredients[name];
      const checkMark = isChecked ? '■' : '[ ]';
      const amountStr = amounts.map(a => `${a.amount} (${a.day}日目)`).join(', ');
      copyText += `${checkMark} ${name}：${amountStr}\n`;
    });
    
    const recipeTitles = selectedRecipes.map(r => `${r.day}日目`).join(', ');
    copyText += `\n(選択されたレシピ: ${recipeTitles})`;
    
    navigator.clipboard.writeText(copyText).then(() => {
      // Temporary toast/button animation for feedback
      const originalText = DOM.btnCopyList.innerHTML;
      DOM.btnCopyList.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        コピー完了!
      `;
      DOM.btnCopyList.style.backgroundColor = 'var(--secondary)';
      setTimeout(() => {
        DOM.btnCopyList.innerHTML = originalText;
        DOM.btnCopyList.style.backgroundColor = '';
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy text', err);
      alert('コピーに失敗しました。お手数ですが手動でコピーしてください。');
    });
  });
}

// --- App Initialization ---
function init() {
  loadState();
  initNavigation();
  initFilters();
  initActionButtons();
  updateUI();
}

window.addEventListener('DOMContentLoaded', init);
