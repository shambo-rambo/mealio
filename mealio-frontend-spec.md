<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" name="viewport"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "primary-fixed-dim": "#87d898",
                        "surface-dim": "#d7dbd4",
                        "primary-fixed": "#a3f5b2",
                        "on-primary": "#ffffff",
                        "secondary-fixed-dim": "#aecfb0",
                        "surface-container-highest": "#e0e4dc",
                        "outline": "#707a6f",
                        "error": "#ba1a1a",
                        "on-primary-container": "#ccffd1",
                        "surface": "#f7fbf3",
                        "error-container": "#ffdad6",
                        "surface-variant": "#e0e4dc",
                        "on-surface-variant": "#404940",
                        "inverse-on-surface": "#eef2ea",
                        "surface-container-lowest": "#ffffff",
                        "on-error-container": "#93000a",
                        "on-tertiary-fixed-variant": "#024688",
                        "inverse-primary": "#87d898",
                        "on-secondary-fixed-variant": "#304d36",
                        "on-secondary-container": "#4c6a50",
                        "on-background": "#181d18",
                        "tertiary": "#205699",
                        "primary": "#096430",
                        "on-secondary-fixed": "#04210d",
                        "secondary-fixed": "#c9ebcb",
                        "on-tertiary-fixed": "#001b3c",
                        "on-primary-fixed": "#00210b",
                        "surface-tint": "#186c37",
                        "on-tertiary": "#ffffff",
                        "on-surface": "#181d18",
                        "secondary": "#48654c",
                        "tertiary-fixed": "#d5e3ff",
                        "surface-container": "#ebefe7",
                        "secondary-container": "#c7e8c8",
                        "tertiary-fixed-dim": "#a7c8ff",
                        "tertiary-container": "#3e6fb3",
                        "background": "#f7fbf3",
                        "inverse-surface": "#2d322d",
                        "on-secondary": "#ffffff",
                        "on-tertiary-container": "#eef2ff",
                        "surface-bright": "#f7fbf3",
                        "on-primary-fixed-variant": "#005225",
                        "surface-container-high": "#e5e9e2",
                        "primary-container": "#2d7d46",
                        "outline-variant": "#bfc9bd",
                        "surface-container-low": "#f1f5ed",
                        "on-error": "#ffffff"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.25rem",
                        "lg": "0.5rem",
                        "xl": "0.75rem",
                        "full": "9999px"
                    },
                    "fontFamily": {
                        "headline": ["Plus Jakarta Sans"],
                        "body": ["Inter"],
                        "label": ["Inter"]
                    }
                },
            },
        }
    </script>
<style>
        body { font-family: 'Inter', sans-serif; -webkit-tap-highlight-color: transparent; }
        .font-headline { font-family: 'Plus Jakarta Sans', sans-serif; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
</head>
<body class="bg-surface text-on-surface min-h-screen pb-40">
<!-- TopAppBar -->
<header class="fixed top-0 w-full z-50 bg-[#f7fbf3]/80 dark:bg-[#181d18]/80 backdrop-blur-xl">
<div class="flex justify-between items-center px-6 py-4 w-full">
<div class="flex items-center gap-3">
<button class="material-symbols-outlined text-[#096430] hover:opacity-80 transition-opacity">arrow_back</button>
<h1 class="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#096430]">Weekly Groceries</h1>
</div>
<div class="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container">
<img alt="Profile" class="w-full h-full object-cover" data-alt="Close up portrait of a smiling father in a sunlit kitchen, warm lifestyle photography style" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_T5C3sv_euf28AKsTWGC6rmqrA6NNI2qv8GMrbwQhtPmwiynmONvfZZ9ZJLbt3KL6ZYXAIEnsW5pF-GXPKy8_SVyy_KG1uc4LMi66f0wyxtFZSWLti-cztzmY_t8VYkVI-hOAaPDss6pzN0N7ugxxj-7WC_grPCv6MtrJuAu6_W00hRjYVjf2L1Qj-ShQSL1lqEKfGrxtiBISDsJAPs8A2XJ9fTGNH8TtDrA-LghIgPX-7IbCEF2WU9dPlJs41Vjp9ZuWmwc-VU2Q"/>
</div>
</div>
</header>
<!-- Tab Navigation (Store Toggle) -->
<nav class="mt-20 px-6">
<div class="flex space-x-2 bg-surface-container-low p-1.5 rounded-full">
<button class="flex-1 py-2 px-4 rounded-full text-sm font-bold bg-primary text-on-primary transition-all shadow-sm">All items</button>
<button class="flex-1 py-2 px-4 rounded-full text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all">Coles</button>
<button class="flex-1 py-2 px-4 rounded-full text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all">Woolworths</button>
</div>
</nav>
<!-- Shopping List Content -->
<main class="mt-8 px-6 space-y-10">
<!-- Category: Produce -->
<section class="space-y-4">
<div class="flex items-center justify-between">
<h2 class="text-on-surface-variant font-headline font-bold text-sm uppercase tracking-widest">Produce</h2>
<span class="text-xs font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">1 ITEM</span>
</div>
<div class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0px_12px_32px_rgba(24,29,24,0.04)]"><div class="flex items-center p-4 gap-4 hover:bg-surface-container-low transition-colors group">
<div class="w-6 h-6 rounded-lg border-2 border-outline-variant flex items-center justify-center group-active:scale-95 transition-transform cursor-pointer"></div>
<div class="flex flex-col flex-1">
<span class="text-on-surface font-medium">Pears</span>
<span class="text-xs text-on-surface-variant">Pack of 4</span>
</div>
<span class="text-sm font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">1</span>
</div></div>
</section>
<!-- Category: Dairy -->
<section class="space-y-4">
<div class="flex items-center justify-between">
<h2 class="text-on-surface-variant font-headline font-bold text-sm uppercase tracking-widest">Dairy</h2>
<span class="text-xs font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">1 ITEM</span>
</div>
<div class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0px_12px_32px_rgba(24,29,24,0.04)]"><div class="flex items-center p-4 gap-4 hover:bg-surface-container-low transition-colors group">
<div class="w-6 h-6 rounded-lg border-2 border-outline-variant flex items-center justify-center group-active:scale-95 transition-transform cursor-pointer"></div>
<div class="flex flex-col flex-1">
<span class="text-on-surface font-medium">Milk</span>
<span class="text-xs text-on-surface-variant">Full cream, 2L</span>
</div>
<span class="text-sm font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">1</span>
</div></div>
</section>
<!-- Category: Meat -->
<section class="space-y-4">
<div class="flex items-center justify-between">
<h2 class="text-on-surface-variant font-headline font-bold text-sm uppercase tracking-widest">Meat</h2>
<span class="text-xs font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">1 ITEM</span>
</div>
<div class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0px_12px_32px_rgba(24,29,24,0.04)]">
<div class="flex items-center p-4 gap-4 hover:bg-surface-container-low transition-colors group">
<div class="w-6 h-6 rounded-lg border-2 border-outline-variant flex items-center justify-center group-active:scale-95 transition-transform cursor-pointer"></div>
<div class="flex flex-col flex-1">
<span class="text-on-surface font-medium">Chicken Breast</span>
<span class="text-xs text-on-surface-variant">Skinless, approx 800g</span>
</div>
<span class="text-sm font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">2</span>
</div>
</div>
</section>
<!-- Category: Bakery -->
<!-- Checked Section -->
<section class="space-y-4 opacity-60"><div class="flex items-center justify-between border-t border-outline-variant/20 pt-6">
<h2 class="text-on-surface-variant font-headline font-bold text-sm uppercase tracking-widest">Checked</h2>
<span class="text-xs font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">0 ITEMS</span>
</div>
<div class="space-y-3">
<!-- No checked items -->
</div></section>
</main>
<!-- Quick Add Input (Sticky) -->
<div class="fixed bottom-24 left-0 w-full px-4 z-40">
<div class="bg-[#e0e4dc]/90 backdrop-blur-2xl rounded-full shadow-[0px_12px_32px_rgba(24,29,24,0.1)] flex items-center px-4 py-3 gap-3">
<span class="material-symbols-outlined text-primary">add_circle</span>
<input class="flex-1 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant/50 font-medium" placeholder="Add an item..." type="text"/>
<button class="material-symbols-outlined text-on-surface-variant p-2 hover:bg-surface-container-high rounded-full transition-colors">barcode_scanner</button>
</div>
</div>
<!-- BottomNavBar -->
<nav class="fixed bottom-0 left-0 w-full h-20 bg-[#e0e4dc]/80 dark:bg-[#252b25]/80 backdrop-blur-2xl flex justify-around items-center px-4 pb-safe z-50 rounded-t-[32px] shadow-[0px_-12px_32px_rgba(24,29,24,0.04)]">
<div class="flex flex-col items-center justify-center text-[#404940] opacity-60 hover:scale-105 transition-transform">
<span class="material-symbols-outlined">calendar_today</span>
<span class="font-['Inter'] font-bold text-[10px] uppercase tracking-wider">Meal Plan</span>
</div>
<div class="flex flex-col items-center justify-center text-[#404940] opacity-60 hover:scale-105 transition-transform">
<span class="material-symbols-outlined">restaurant_menu</span>
<span class="font-['Inter'] font-bold text-[10px] uppercase tracking-wider">Recipes</span>
</div>
<div class="flex flex-col items-center justify-center text-[#096430] shadow-[0_4px_12px_rgba(9,100,48,0.1)] hover:scale-105 transition-transform">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">shopping_basket</span>
<span class="font-['Inter'] font-bold text-[10px] uppercase tracking-wider">Shopping</span>
</div>
<div class="flex flex-col items-center justify-center text-[#404940] opacity-60 hover:scale-105 transition-transform">
<span class="material-symbols-outlined">group</span>
<span class="font-['Inter'] font-bold text-[10px] uppercase tracking-wider">Family</span>
</div>
</nav>
</body></html>