# 1. Introduction

Aucune inscription n'est requise, configuration simple !  
InsightBuddy Chat est un assistant de chat IA utilisable sur des sites web. En configurant simplement la clé API de votre fournisseur d'IA préféré — que ce soit OpenAI, Anthropic, Google ou un autre — vous pouvez l'utiliser immédiatement.  
De plus, il peut également se connecter à votre environnement auto-hébergé compatible avec OpenAI.

- À partir de février 2025, le Gemini de Google est partiellement gratuit, ce qui vous permet d'utiliser l'IA générative gratuitement si vous en profitez.
- L'article suivant résume comment configurer un compte ( https://j-aic.com/techblog/google-ai-studio-api-free ).

## 1.1 Caractéristiques principales

- Prise en charge de plusieurs fournisseurs d'IA
- Permet des conversations prenant en compte le contenu du site web
- Comprend une fonctionnalité d'enregistrement de l'historique des chats
- Grâce à la fonctionnalité de guide, vous pouvez exécuter des actions spécifiques sur des sites désignés

## 1.2 Gestion de l'information

- Les clés API et l'historique des chats sont stockés uniquement localement sur votre appareil.
- Pour plus de détails sur la gestion des données transmises via la fonction de chat, veuillez consulter les conditions d'utilisation de chaque fournisseur de modèles.
- Notre entreprise ne collecte pas de données d'utilisation ni d'autres informations uniquement via cette fonctionnalité.

---

# 2. Configuration initiale

## 2.1 Étapes pour configurer le fournisseur d'API

1. **Ouvrez l'écran de configuration de l'API**  
   - Ouvrez le widget de chat en bas à droite de l'écran  
   - Cliquez sur l'icône "Accueil" dans le menu inférieur  
   - Cliquez sur "Paramètres de l'API" dans le menu de gauche
2. **Sélectionnez le fournisseur et saisissez la clé API**  
   - Repérez la carte du fournisseur d'IA souhaité  
   - Cliquez sur l'icône d'engrenage pour accéder au mode de configuration  
   - Saisissez votre clé API  
   - Cliquez sur "Enregistrer"
3. **Sélectionnez le modèle**  
   - Cliquez sur "Sélectionner le modèle" sur la carte du fournisseur  
   - Choisissez dans la liste des modèles disponibles
4. **Activez le fournisseur**  
   - Après la configuration, activez le commutateur  
   - L'état se mettra à jour une fois la configuration correctement effectuée

## 2.2 Fournisseurs pris en charge

### OpenAI

- Format de la clé : Une chaîne commençant par `sk-`
- Modèles principaux : GPT-4, GPT-3.5-turbo
- Obtention de la clé API : Disponible sur le site d'OpenAI

### Anthropic

- Format de la clé : Une chaîne commençant par `sk-ant-api`
- Modèles principaux : Claude-3-Opus, Claude-3-Sonnet
- Obtention de la clé API : Disponible sur le site d'Anthropic

### Google Gemini

- Format de la clé : Une chaîne commençant par `AIza`
- Modèle principal : gemini-pro
- Obtention de la clé API : Disponible via Google Cloud Console

### Deepseek

- Format de la clé : Une chaîne commençant par `sk-ds-api`
- Modèles principaux : Deepseek-LLM, Deepseek-XL
- Obtention de la clé API : Disponible sur le site de Deepseek

### Compatible avec OpenAI

- Format de la clé : N'importe quelle chaîne (selon les spécifications du fournisseur)
- Modèles principaux : Modèles compatibles avec OpenAI fournis par le fournisseur
- Obtention de la clé API : Disponible sur le site de chaque fournisseur
- Remarques particulières :
  - Nécessite la configuration d'une URL de point final personnalisée
  - Nécessite la saisie manuelle du nom du modèle
  - Peut être utilisé avec tout service proposant une API compatible avec OpenAI

### API locale

- Il s'agit de l'API propriétaire d'InsightBuddy.
- Disponible pour utilisation sur accord séparé.
- Offre des fonctionnalités telles que la lecture de formulaires et une interface de saisie de formulaire.

---

# 3. Utilisation de base

## 3.1 Démarrer une conversation

1. Cliquez sur l'onglet bleu situé sur le bord droit de votre navigateur.
2. Le widget de chat s'ouvrira.
3. Saisissez votre message dans le champ de saisie en bas.
4. Cliquez sur le bouton d'envoi ou appuyez sur Entrée pour envoyer votre message.

## 3.2 Utilisation de la fonction de chat

- **Démarrer un nouveau chat**  
  - Cliquez sur l'icône "+" en haut à droite.
- **Afficher l'historique des chats**  
  - Cliquez sur l'icône d'horloge dans le menu inférieur.  
  - Sélectionnez une conversation précédente pour l'afficher.
- **Utiliser le contenu du site web**  
  - Lorsque l'option "Récupérer le contenu actuel du site web" est activée, l'assistant prend en compte le contenu de la page en cours lors de la génération d'une réponse.

---

# 4. Dépannage

## 4.1 Erreurs courantes et leurs solutions

### Erreur de clé API

- **Symptôme** : Un message d'erreur indiquant "La clé API n'est pas valide."
- **Solution** :
  1. Vérifiez que le format de la clé API est correct.
  2. Vérifiez la date d'expiration de la clé API.
  3. Obtenez une nouvelle clé API si nécessaire.

### Erreur de connexion

- **Symptôme** : Impossible d'envoyer le message.
- **Solution** :
  1. Vérifiez votre connexion Internet.
  2. Rechargez votre navigateur.
  3. Vérifiez l'état du fournisseur d'API.

### Erreur de sélection du modèle

- **Symptôme** : Aucun modèle ne peut être sélectionné.
- **Solution** :
  1. Vérifiez les autorisations associées à votre clé API.
  2. Vérifiez les limitations d'utilisation du fournisseur.
  3. Essayez de sélectionner un modèle différent.

### Erreur de connexion avec un service compatible OpenAI

- **Symptôme** : Impossible de se connecter ou de recevoir une réponse.
- **Solution** :
  1. Vérifiez que l'URL du point final est correcte.
  2. Assurez-vous que le nom du modèle saisi respecte les spécifications du fournisseur.
  3. Confirmez que le format de la clé API répond aux exigences du fournisseur.
  4. Vérifiez l'état du service du fournisseur.

## 4.2 Réinitialisation de la configuration

1. Ouvrez l'écran de configuration de l'API.
2. Désactivez les paramètres de chaque fournisseur.
3. Saisissez à nouveau les clés API.
4. Sélectionnez de nouveau les modèles.

---

# 5. Sécurité et confidentialité

## 5.1 Gestion des données

- Les clés API sont stockées de manière chiffrée localement sur votre appareil.
- L'historique des chats est stocké uniquement localement.
- Les informations du site web sont utilisées uniquement dans la mesure nécessaire.

## 5.2 Mesures de sécurité recommandées

- Mettez à jour régulièrement vos clés API.
- Désactivez les fournisseurs qui ne sont pas utilisés.
- Vérifiez les paramètres de confidentialité de votre navigateur.

## 5.3 Vérification des mises à jour

- Assurez-vous que les mises à jour automatiques de l'extension Chrome sont activées.
- Vérifiez et mettez à jour régulièrement vos paramètres.

---

# 6. Spécifications techniques

## 6.1 Système de dialogue multi-tour

### Conception de base

- **Nombre maximum de tours conservés :** 4 tours  
  - Limité pour optimiser l'utilisation des tokens.
  - Un tour = message de l'utilisateur + réponse de l'IA.
  - À partir du cinquième tour, les tours les plus anciens sont supprimés.

### Gestion de la conversation mise en œuvre

- **Historique de conversation géré au format Markdown**
  - **Dialogue récent :** Historique des conversations précédentes
  - **Message actuel de l'utilisateur :** Saisie actuelle
  - **Contexte de la page :** Informations sur la page web actuelle (optionnel)
  - **Configuration Markdown :**

    ```markdown
    # Dialogue récent
    ## Tour 1
    ### Utilisateur
    Contenu du message de l'utilisateur
    ### Assistant
    Contenu de la réponse de l'IA
    # Message actuel de l'utilisateur
    Saisie actuelle de l'utilisateur
    # Contexte de la page (optionnel)
    Contenu de la page web
    ```

- **Un message système est ajouté à chaque requête**
  - Les réponses sont fournies dans la langue de l'utilisateur.
  - Des restrictions s'appliquent quant à l'utilisation de décorations et de Markdown.
  - Cela garantit la cohérence de la conversation.
  - **Configuration du message système :**

    ```text
    Vous êtes un assistant IA performant. Veuillez répondre selon les instructions suivantes :

    # Comportement de base
    - Le message envoyé par l'utilisateur est stocké dans ("Message actuel de l'utilisateur").
    - Répondez dans la même langue que celle utilisée par l'utilisateur dans ("Message actuel de l'utilisateur").
    - Vos réponses doivent être concises et précises.
    - N'utilisez pas de décorations ni de Markdown.

    # Traitement de l'historique de la conversation
    - Comprenez le contexte en vous référant à l'historique de conversation formaté en Markdown ("Dialogue récent").
    - Chaque tour est indiqué par "Tour X" et contient le dialogue entre l'utilisateur et l'assistant.
    - Essayez de fournir des réponses cohérentes avec la conversation précédente.

    # Traitement des informations web
    - Si une section "Contexte de la page" existe, tenez compte du contenu de cette page lors de votre réponse.
    - Utilisez les informations de la page comme complément en ne vous référant qu'aux éléments directement liés à la question de l'utilisateur.
    ```

---

## 6.2 Système de traitement du contexte

### Récupération des informations de la page web

- **Implémentation pour optimiser l'utilisation des tokens**
  - Le contenu de la page web est récupéré à chaque requête (non sauvegardé dans l'historique).
  - L'utilisation des tokens est réduite grâce à l'optimisation du HTML.
  - Les éléments inutiles (comme `<script>`, `<style>`, `<iframe>`, etc.) sont supprimés.
- **Fonction pour activer/désactiver le contexte de la page**
  - Permet à l'utilisateur d'activer ou de désactiver cette fonctionnalité.
  - Activée automatiquement lors de l'utilisation de l'API locale.

### Fonctionnalité de lecture de formulaires

- Reconnaît automatiquement les éléments de formulaire.
- **Intégration avec la fonctionnalité d'analyse de PDF**
  - Détection automatique des fichiers PDF.
  - Processus d'extraction de texte.
  - Intégration avec le contexte initial du formulaire.

---

## 6.3 Système de gestion des fournisseurs

### Implémentations spécifiques aux fournisseurs

- **OpenAI / Deepseek**
  - Utilise l'authentification Bearer.
  - Prend en charge la récupération automatique des modèles.
- **Anthropic**
  - Utilise l'authentification x-api-key.
  - Nécessite de spécifier une version (par exemple, 2023-06-01).
- **Google Gemini**
  - S'authentifie via une clé API.
  - Prend en charge un format de réponse unique.
- **Compatible avec OpenAI**
  - Prend en charge la configuration d'un point final personnalisé.
  - Nécessite la saisie manuelle du nom du modèle.
  - Permet des méthodes d'authentification personnalisables.
- **API locale**
  - Prend en charge les points finaux personnalisés.
  - Utilise un système d'authentification propriétaire.

### Fonctionnalité de changement de fournisseur

- Un seul fournisseur peut être activé à la fois.
- Effectue une vérification de l'intégrité de la configuration :
  - Valide le format de la clé API.
  - Vérifie que les éléments de configuration requis sont présents.
  - Vérifie qu'un modèle a été sélectionné.

---

## 6.4 Système de gestion de l'historique

### Fonctionnalité de sauvegarde mise en œuvre

- Conserve jusqu'à 30 historiques de conversation.
- **Les données sauvegardées comprennent :**
  - Informations sur le fournisseur
  - Modèle sélectionné
  - Horodatage
  - Historique des messages
- **Intégration avec l'API de stockage de Chrome :**
  - Permet le partage des données entre extensions.
  - Utilise le stockage local comme solution de secours.

### Fonctionnalités de l'historique

- **Fonction de modification de conversation**
  - Permet de modifier les messages.
  - Régénère les réponses après modification.
  - Met à jour automatiquement les messages suivants.
- Filtrage de l'historique.
- **Vérification de la compatibilité du fournisseur**
  - Vérifie que le modèle sélectionné correspond bien au fournisseur.
  - Affiche des avertissements de compatibilité si nécessaire.

---

## 6.5 Mise en œuvre du widget de chat

### Fonctions UI/UX

- **Implémenté à l'aide d'iframes**
  - Isolé de la page parente.
  - Communique via l'envoi de messages.
- **Design réactif**
  - Ajuste l'affichage en fonction de la taille de l'écran.
  - Redimensionne automatiquement la zone de saisie.

### Fonctions spéciales

- **Affichage des informations du site**
  - Affiche le contenu HTML.
  - Affiche le contenu des formulaires.
- **Gestion des messages**
  - Créer un nouveau chat.
  - Modifier et renvoyer des chats (note : la réutilisation des informations du site n'est pas autorisée).
  - Activer/désactiver l'affichage de l'historique des chats.

---

## 6.6 Implémentations de sécurité

### Gestion de l'API

- **Stockage sécurisé des clés API**
  - Utilise l'API de stockage de Chrome.
  - Masque les clés lorsqu'elles sont affichées.

### Protection des données

- **Limitation du contexte de la page**
  - Ne récupère que les informations nécessaires.
  - Exclut les données sensibles.
- **Gestion locale des données**
  - Gère les données de session.

---

## 6.7 Journal de débogage

- Le journal de débogage suivant est affiché :

  ```javascript
  console.group('Informations de débogage sur la transmission de l’API externe');
  console.log('Message envoyé :', message);
  console.log('Configuration de l’API :', {
      provider: apiConfig.provider,
      model: apiConfig.model,
      customSettings: apiConfig.customSettings
  });
  console.log('Réponse de l’API :', result);
  console.groupEnd();