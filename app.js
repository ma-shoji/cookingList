// --- App State Management ---
let state = {
  selectedDishes: [], // Array of strings like ["1-main", "1-side", "2-main"]
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
  localStorage.setItem('cooking_app_state_v2', JSON.stringify({
    selectedDishes: state.selectedDishes,
    checkedIngredients: state.checkedIngredients
  }));
}

function loadState() {
  // Try loading v2 state first
  const savedV2 = localStorage.getItem('cooking_app_state_v2');
  if (savedV2) {
    try {
      const parsed = JSON.parse(savedV2);
      state.selectedDishes = parsed.selectedDishes || [];
      state.checkedIngredients = parsed.checkedIngredients || {};
      return;
    } catch (e) {
      console.error("Failed to parse saved state v2", e);
    }
  }
  
  // Migration fallback from v1
  const savedV1 = localStorage.getItem('cooking_app_state');
  if (savedV1) {
    try {
      const parsed = JSON.parse(savedV1);
      const selectedDays = parsed.selectedDays || [];
      // Migrate selected days to main + side
      state.selectedDishes = [];
      selectedDays.forEach(day => {
        state.selectedDishes.push(`${day}-main`);
        state.selectedDishes.push(`${day}-side`);
      });
      state.checkedIngredients = parsed.checkedIngredients || {};
      saveState(); // Save to v2 immediately
    } catch (e) {
      console.error("Failed to parse saved state v1 during migration", e);
    }
  }
}

// Extract appliance tag from dish name, e.g., "無水肉じゃが（電気圧力鍋）" -> "電気圧力鍋"
function getApplianceTag(dishName) {
  if (!dishName) return null;
  const match = dishName.match(/[（(](電気圧力鍋|ノンフライヤー|レンジ|フライパン|ガスコンロ)[）)]/);
  return match ? match[1] : null;
}

// Determine if an ingredient in the shopping list belongs to a specific dish's ingredients text
function isIngredientForDish(itemName, dishIngredientsText) {
  if (!dishIngredientsText) return false;
  
  // Remove parentheses/brackets and trim for clean comparison
  const cleanName = itemName.replace(/[（(].*?[）)]/g, '').trim();
  
  if (dishIngredientsText.includes(cleanName)) return true;
  
  // Test partial match of 2-3 characters (useful for suffix/prefix differences like "人参" vs "人参1/2本")
  const shortName = cleanName.slice(0, 3);
  if (shortName.length >= 2 && dishIngredientsText.includes(shortName)) return true;
  
  // Specific common ingredient mapping
  if (cleanName === '卵' && dishIngredientsText.includes('卵')) return true;
  if (cleanName.includes('ひき肉') && dishIngredientsText.includes('ひき肉')) return true;
  if (cleanName.includes('鮭') && dishIngredientsText.includes('鮭')) return true;
  if (cleanName.includes('サバ') && dishIngredientsText.includes('サバ')) return true;
  if (cleanName.includes('イカ') && dishIngredientsText.includes('イカ')) return true;
  if (cleanName.includes('タラ') && dishIngredientsText.includes('タラ')) return true;
  if (cleanName.includes('白身魚') && (dishIngredientsText.includes('白身魚') || dishIngredientsText.includes('タラ'))) return true;
  
  return false;
}

// Check if a shopping item belongs to the selected main/side dishes
function shouldIncludeIngredient(itemName, recipe) {
  const isMainSelected = state.selectedDishes.includes(`${recipe.day}-main`);
  const isSideSelected = state.selectedDishes.includes(`${recipe.day}-side`);
  
  // If both selected, it's definitely included
  if (isMainSelected && isSideSelected) return true;
  // If neither, definitely excluded
  if (!isMainSelected && !isSideSelected) return false;
  
  const mainText = recipe.main ? recipe.main.ingredients : '';
  const sideText = recipe.side ? recipe.side.ingredients : '';
  
  const matchesMain = isIngredientForDish(itemName, mainText);
  const matchesSide = isIngredientForDish(itemName, sideText);
  
  if (isMainSelected && matchesMain) return true;
  if (isSideSelected && matchesSide) return true;
  
  // Fallback: If it matches neither text, we include it if either is selected (to prevent missing items)
  if (!matchesMain && !matchesSide) {
    return true;
  }
  
  return false;
}

// --- Render Functions ---

// 1. Render Recipes Tab
function renderRecipes() {
  DOM.recipesList.innerHTML = '';
  
  RECIPES.forEach(recipe => {
    // Collect appliances
    const tags = [];
    if (recipe.main && recipe.main.name) {
      const t = getApplianceTag(recipe.main.name);
      if (t) tags.push({ type: 'main', label: t });
    }
    if (recipe.side && recipe.side.name) {
      const t = getApplianceTag(recipe.side.name);
      if (t) tags.push({ type: 'side', label: t });
    }
    
    // Filter matching
    if (state.currentFilter !== 'all') {
      const displayFilter = state.currentFilter === '圧力鍋' ? '電気圧力鍋' : state.currentFilter;
      const hasMatchingAppliance = tags.some(tag => tag.label === displayFilter);
      if (!hasMatchingAppliance) {
        return; // Skip card
      }
    }
    
    const isMainSelected = state.selectedDishes.includes(`${recipe.day}-main`);
    const isSideSelected = state.selectedDishes.includes(`${recipe.day}-side`);
    const hasSelected = isMainSelected || isSideSelected;
    
    const card = document.createElement('div');
    card.className = `recipe-card ${hasSelected ? 'has-selected' : ''}`;
    card.dataset.day = recipe.day;
    
    // Build tags HTML
    const uniqueApplianceNames = Array.from(new Set(tags.map(t => t.label)));
    const tagsHtml = uniqueApplianceNames.map(tag => {
      let tagClass = 'tag';
      if (tag === '電気圧力鍋') tagClass += ' tag-pressure';
      else if (tag === 'ノンフライヤー') tagClass += ' tag-fryer';
      else if (tag === 'レンジ') tagClass += ' tag-range';
      else if (tag === 'フライパン' || tag === 'ガスコンロ') tagClass += ' tag-pan';
      
      return `<span class="${tagClass}">${tag}</span>`;
    }).join('');
    
    card.innerHTML = `
      <div class="card-top">
        <span class="day-badge">${recipe.day}日目</span>
      </div>
      <h3 class="recipe-title">${recipe.title.replace(/【\d+日目】/, '')}</h3>
      
      <div class="dishes-preview" style="gap: 10px; margin: 8px 0;">
        <!-- Main Dish Selector -->
        ${recipe.main ? `
        <div class="dish-selector-item ${isMainSelected ? 'selected' : ''}" data-dish-id="${recipe.day}-main">
          <label class="recipe-checkbox-container" onclick="event.stopPropagation();">
            <input type="checkbox" ${isMainSelected ? 'checked' : ''} data-dish-id="${recipe.day}-main">
            <span class="checkmark"></span>
          </label>
          <span class="dish-label main-tag">主菜</span>
          <span class="name" title="${recipe.main.name}">${recipe.main.name}</span>
        </div>
        ` : ''}
        
        <!-- Side Dish Selector -->
        ${recipe.side ? `
        <div class="dish-selector-item ${isSideSelected ? 'selected' : ''}" data-dish-id="${recipe.day}-side">
          <label class="recipe-checkbox-container" onclick="event.stopPropagation();">
            <input type="checkbox" ${isSideSelected ? 'checked' : ''} data-dish-id="${recipe.day}-side">
            <span class="checkmark"></span>
          </label>
          <span class="dish-label side-tag">副菜</span>
          <span class="name" title="${recipe.side.name}">${recipe.side.name}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="recipe-tags">
        ${tagsHtml}
      </div>
    `;
    
    // Bind click listeners for selector items
    const selectors = card.querySelectorAll('.dish-selector-item');
    selectors.forEach(selector => {
      const dishId = selector.dataset.dishId;
      const checkbox = selector.querySelector('input[type="checkbox"]');
      
      const toggle = () => {
        toggleDishSelection(dishId);
      };
      
      selector.addEventListener('click', toggle);
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        toggleDishSelection(dishId);
      });
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

// Toggle dish selection
function toggleDishSelection(dishId) {
  const index = state.selectedDishes.indexOf(dishId);
  if (index === -1) {
    state.selectedDishes.push(dishId);
  } else {
    state.selectedDishes.splice(index, 1);
  }
  
  saveState();
  updateUI();
}

// 2. Render & Update Shopping List Tab
function updateShoppingList() {
  // Update selected count (total individual dishes chosen)
  DOM.selectedRecipesCount.textContent = state.selectedDishes.length;
  
  // Update badge count
  if (state.selectedDishes.length > 0) {
    DOM.navBadgeCount.textContent = state.selectedDishes.length;
    DOM.navBadgeCount.classList.add('visible');
  } else {
    DOM.navBadgeCount.classList.remove('visible');
  }
  
  if (state.selectedDishes.length === 0) {
    DOM.shoppingListEmpty.style.display = 'flex';
    DOM.shoppingList.style.display = 'none';
    DOM.shoppingList.innerHTML = '';
    return;
  }
  
  DOM.shoppingListEmpty.style.display = 'none';
  DOM.shoppingList.style.display = 'flex';
  
  // Merge ingredients based on selected dishes
  const mergedIngredients = {};
  
  RECIPES.forEach(recipe => {
    // Check if any dish in this recipe is selected
    const isMainSelected = state.selectedDishes.includes(`${recipe.day}-main`);
    const isSideSelected = state.selectedDishes.includes(`${recipe.day}-side`);
    
    if (isMainSelected || isSideSelected) {
      recipe.shopping.forEach(item => {
        // Evaluate if this specific item should be purchased
        if (shouldIncludeIngredient(item.name, recipe)) {
          const name = item.name.trim();
          const amount = item.amount.trim();
          
          if (!mergedIngredients[name]) {
            mergedIngredients[name] = [];
          }
          mergedIngredients[name].push({
            amount: amount,
            day: recipe.day
          });
        }
      });
    }
  });
  
  DOM.shoppingList.innerHTML = '';
  
  const mergedKeys = Object.keys(mergedIngredients);
  if (mergedKeys.length === 0) {
    DOM.shoppingListEmpty.style.display = 'flex';
    DOM.shoppingList.style.display = 'none';
    return;
  }
  
  mergedKeys.forEach(name => {
    const details = mergedIngredients[name];
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
        delete state.checkedIngredients[name];
      }
      saveState();
      li.classList.toggle('checked');
    });
    
    DOM.shoppingList.appendChild(li);
  });
}

// 3. Render Cooking Instructions Tab
function renderCookingInstructions() {
  // Find which days have any selection
  const selectedDaysWithDishes = new Set();
  state.selectedDishes.forEach(id => {
    const day = parseInt(id.split('-')[0]);
    selectedDaysWithDishes.add(day);
  });
  
  const sortedDays = Array.from(selectedDaysWithDishes).sort((a, b) => a - b);
  
  if (sortedDays.length === 0) {
    DOM.cookingListEmpty.style.display = 'flex';
    DOM.cookingRecipesList.style.display = 'none';
    DOM.cookingRecipesList.innerHTML = '';
    return;
  }
  
  DOM.cookingListEmpty.style.display = 'none';
  DOM.cookingRecipesList.style.display = 'flex';
  DOM.cookingRecipesList.innerHTML = '';
  
  sortedDays.forEach((dayNum, idx) => {
    const recipe = RECIPES.find(r => r.day === dayNum);
    if (!recipe) return;
    
    const isMainSelected = state.selectedDishes.includes(`${dayNum}-main`);
    const isSideSelected = state.selectedDishes.includes(`${dayNum}-side`);
    
    const card = document.createElement('div');
    const isExpanded = idx === 0;
    card.className = `cooking-card ${isExpanded ? 'expanded' : ''}`;
    
    // Header text changes based on selection
    let subTitleText = "";
    if (isMainSelected && isSideSelected) subTitleText = "主菜・副菜の両方";
    else if (isMainSelected) subTitleText = "主菜のみ";
    else if (isSideSelected) subTitleText = "副菜のみ";
    
    card.innerHTML = `
      <div class="cooking-card-header">
        <div>
          <h3>${recipe.title}</h3>
          <span style="font-size: 11px; color: var(--primary); font-weight: 600;">${subTitleText}</span>
        </div>
        <span class="toggle-arrow">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
          </svg>
        </span>
      </div>
      <div class="cooking-card-body">
        <!-- Main Dish Section -->
        ${recipe.main && isMainSelected ? `
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
        
        <!-- Side Dish Section -->
        ${recipe.side && isSideSelected ? `
        <div class="dish-section" style="${recipe.main && isMainSelected ? 'margin-top: 15px;' : ''}">
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
      state.selectedDishes = [];
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
    if (state.selectedDishes.length === 0) return;
    
    const selectedDaysWithDishes = new Set();
    state.selectedDishes.forEach(id => {
      selectedDaysWithDishes.add(parseInt(id.split('-')[0]));
    });
    const sortedDays = Array.from(selectedDaysWithDishes).sort((a, b) => a - b);
    
    // Merge ingredients to build copy text
    const mergedIngredients = {};
    RECIPES.forEach(recipe => {
      const isMainSelected = state.selectedDishes.includes(`${recipe.day}-main`);
      const isSideSelected = state.selectedDishes.includes(`${recipe.day}-side`);
      
      if (isMainSelected || isSideSelected) {
        recipe.shopping.forEach(item => {
          if (shouldIncludeIngredient(item.name, recipe)) {
            const name = item.name.trim();
            const amount = item.amount.trim();
            if (!mergedIngredients[name]) {
              mergedIngredients[name] = [];
            }
            mergedIngredients[name].push({ amount, day: recipe.day });
          }
        });
      }
    });
    
    let copyText = `🛒 【買い物リスト】\n`;
    Object.keys(mergedIngredients).forEach(name => {
      const amounts = mergedIngredients[name];
      const isChecked = !!state.checkedIngredients[name];
      const checkMark = isChecked ? '■' : '[ ]';
      const amountStr = amounts.map(a => `${a.amount} (${a.day}日目)`).join(', ');
      copyText += `${checkMark} ${name}：${amountStr}\n`;
    });
    
    // Formulate chosen dish details for footer
    const chosenTitles = state.selectedDishes.map(id => {
      const [day, type] = id.split('-');
      const recipe = RECIPES.find(r => r.day === parseInt(day));
      const typeLabel = type === 'main' ? '主菜' : '副菜';
      const name = type === 'main' ? recipe.main.name : recipe.side.name;
      // strip tag brackets
      const cleanName = name.replace(/[（(].*?[）)]/g, '').trim();
      return `${day}日目(${typeLabel}): ${cleanName}`;
    }).join('\n- ');
    
    copyText += `\n【選択された料理】\n- ${chosenTitles}`;
    
    navigator.clipboard.writeText(copyText).then(() => {
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
