import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import storageService from '../services/storageService';
import { supabase } from '../services/supabaseClient';

const ThemeContext = createContext(null);

const ACCENT_PRESETS = [
    // ── Sólidas ──
    { id: 'purple', name: 'Roxo', color: '#7c3aed', secondary: '#6d28d9' },
    { id: 'blue', name: 'Azul', color: '#3b82f6', secondary: '#2563eb' },
    { id: 'sky', name: 'Céu', color: '#0ea5e9', secondary: '#0284c7' },
    { id: 'cyan', name: 'Ciano', color: '#06b6d4', secondary: '#0891b2' },
    { id: 'teal', name: 'Turquesa', color: '#14b8a6', secondary: '#0d9488' },
    { id: 'green', name: 'Verde', color: '#10b981', secondary: '#059669' },
    { id: 'lime', name: 'Lima', color: '#84cc16', secondary: '#65a30d' },
    { id: 'amber', name: 'Âmbar', color: '#f59e0b', secondary: '#d97706' },
    { id: 'orange', name: 'Laranja', color: '#f97316', secondary: '#ea580c' },
    { id: 'rose', name: 'Rosa', color: '#f43f5e', secondary: '#e11d48' },
    { id: 'crimson', name: 'Carmesim', color: '#dc2626', secondary: '#b91c1c' },
    { id: 'pink', name: 'Rosa Claro', color: '#ec4899', secondary: '#db2777' },
    { id: 'fuchsia', name: 'Fúcsia', color: '#d946ef', secondary: '#c026d3' },
    { id: 'violet', name: 'Violeta', color: '#8b5cf6', secondary: '#7c3aed' },
    { id: 'indigo', name: 'Índigo', color: '#6366f1', secondary: '#4f46e5' },
    { id: 'slate', name: 'Ardósia', color: '#64748b', secondary: '#475569' },
    // ── Gradientes ──
    { id: 'grad-aurora', name: 'Aurora', color: '#a855f7', secondary: '#06b6d4', gradient: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' },
    { id: 'grad-sunset', name: 'Pôr do Sol', color: '#f97316', secondary: '#e11d48', gradient: 'linear-gradient(135deg, #f97316 0%, #e11d48 100%)' },
    { id: 'grad-ocean', name: 'Oceano', color: '#3b82f6', secondary: '#06b6d4', gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' },
    { id: 'grad-forest', name: 'Floresta', color: '#10b981', secondary: '#84cc16', gradient: 'linear-gradient(135deg, #10b981 0%, #84cc16 100%)' },
    { id: 'grad-candy', name: 'Candy', color: '#ec4899', secondary: '#a855f7', gradient: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)' },
    { id: 'grad-fire', name: 'Chamas', color: '#dc2626', secondary: '#f97316', gradient: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)' },
    { id: 'grad-midnight', name: 'Meia-Noite', color: '#1e1b4b', secondary: '#4f46e5', gradient: 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)' },
    { id: 'grad-rose-gold', name: 'Ouro Rosé', color: '#f43f5e', secondary: '#f59e0b', gradient: 'linear-gradient(135deg, #f43f5e 0%, #f59e0b 100%)' },
];

const THEME_PRESETS = [
    { id: 'light', name: 'Claro', icon: 'sun' },
    { id: 'dark', name: 'Escuro', icon: 'moon' },
    { id: 'dim', name: 'Dim', icon: 'dim' },
    { id: 'oled', name: 'OLED', icon: 'oled' },
];

const FONT_PRESETS = [
    { id: 'poppins', name: 'Poppins', family: "'Poppins', sans-serif" },
    { id: 'inter', name: 'Inter', family: "'Inter', sans-serif" },
    { id: 'nunito', name: 'Nunito', family: "'Nunito', sans-serif" },
    { id: 'outfit', name: 'Outfit', family: "'Outfit', sans-serif" },
    { id: 'dm-sans', name: 'DM Sans', family: "'DM Sans', sans-serif" },
    { id: 'raleway', name: 'Raleway', family: "'Raleway', sans-serif" },
];

// ── Translations ──
const TRANSLATIONS = {
    'pt-br': {
        myday: 'Meu Dia', important: 'Importante', planned: 'Planejado',
        dashboard: 'Visão Geral', boards: 'BOARDS', general: 'GERAL',
        resources: 'WIDGETS', others: 'OUTROS', focusMode: 'Modo Foco',
        settings: 'Configurações', help: 'Central de Ajuda', logout: 'Sair',
        search: 'Buscar tarefas...', notifications: 'Notificações', newBoard: 'Novo Board',
        stAccount: 'Conta', stSecurity: 'Segurança', stAppearance: 'Aparência', stApp: 'Aplicativo', stLanguage: 'Idioma',
        acTitle: 'Conta', acSubtitle: 'Gerencie suas informações pessoais',
        acPersonalInfo: 'Informações Pessoais', acName: 'Nome', acNamePh: 'Seu nome',
        acUsername: 'Username', acEmail: 'E-mail',
        acEmailHint: 'Alterar e-mail requer confirmação na conta do provedor.',
        acBio: 'Bio', acBioPh: 'Conte um pouco sobre você...',
        acSave: 'Salvar Alterações', acSaved: 'Salvo! ✓',
        acDangerZone: 'Zona de Perigo',
        acClearData: 'Limpar todos os dados', acClearDataDesc: 'Remove todos os boards, tarefas e configurações', acClearBtn: 'Limpar',
        acLogout: 'Sair da conta', acLogoutDesc: 'Encerrar a sessão atual', acLogoutBtn: 'Sair',
        avChangePhoto: 'Alterar foto', avSetPhoto: 'Definir foto', avSetEmoji: 'Definir emoji', avRemovePhoto: 'Remover foto',
        avSetEmojiDisabled: 'Definir emoji (remova a foto primeiro)',
        secTitle: 'Segurança', secSubtitle: 'Verificação em duas etapas e contas vinculadas',
        secEmailLogin: 'E-mail e login', secEmailVerified: 'E-mail verificado', secPasswordLinked: 'Senha vinculada',
        secNoPasswordHint: 'Defina uma senha abaixo para entrar também com e-mail e senha.',
        secPassword: 'Senha', secSetPasswordDesc: 'Defina uma senha para poder entrar com e-mail e senha.',
        secPasswordSuccess: 'Senha definida. Agora você pode entrar com e-mail e senha.',
        secPasswordChanged: 'Senha alterada com sucesso.',
        secCurrentPassword: 'Senha atual', secCurrentPasswordPh: 'Sua senha atual',
        secNewPassword: 'Nova senha', secNewPasswordPh: 'Mínimo 6 caracteres',
        secConfirmPassword: 'Confirmar senha', secConfirmPasswordNew: 'Confirmar nova senha',
        secPasswordPh2: 'Repita a senha', secPasswordPh3: 'Repita a nova senha',
        secSetPassword: 'Definir senha', secChangePassword: 'Alterar senha',
        sec2fa: 'Verificação em duas etapas (2FA)', sec2faActive: '2FA ativo', secDisable2fa: 'Desativar 2FA',
        sec2faScanDesc: 'Escaneie o QR code com seu app autenticador (Google Authenticator, Authy, etc.):',
        sec2faCodePh: 'Código de 6 dígitos', sec2faConfirm: 'Confirmar e ativar 2FA',
        sec2faDesc: 'Proteja sua conta com um código gerado no celular.',
        sec2faActivating: 'Abrindo...', sec2faEnable: 'Ativar 2FA',
        secLinkedAccounts: 'Contas vinculadas', secLinkedDesc: 'Vincule Google, GitHub ou Microsoft para entrar com um clique.',
        secLoading: 'Carregando...', secLinked: 'Vinculado', secNotLinked: 'Não vinculado',
        secUnlink: 'Desvincular', secLink: 'Vincular',
        appTitle: 'Aparência', appSubtitle: 'Personalize o visual do seu DailyWays',
        sTheme: 'Tema', sThemeLight: 'Claro', sThemeDark: 'Escuro',
        sAccentColor: 'Cor de Destaque', sAccentDesc: 'Escolha a cor principal da interface',
        sZoom: 'Tamanho da Interface',
        sFont: 'Fonte', sFontDesc: 'Escolha a fonte da interface',
        sAnimStyle: 'Estilo de Animação', sAnimDesc: 'Controla o nível de animações da interface',
        sAnimSmooth: 'Suave', sAnimSmoothDesc: 'Animações fluidas e elegantes',
        sAnimFlat: 'Flat', sAnimFlatDesc: 'Sem animações, navegação direta',
        appTabTitle: 'Aplicativo', appTabSubtitle: 'Configurações gerais do aplicativo',
        sNotifications: 'Notificações', sNotifPush: 'Notificações Push', sNotifPushDesc: 'Receba alertas sobre tarefas vencendo',
        sSounds: 'Sons', sSoundsDesc: 'Tocar sons ao completar tarefas',
        sAutoSave: 'Salvar automaticamente', sAutoSaveDesc: 'Salvar alterações em tempo real',
        sData: 'Dados', sVersion: 'Versão', sStorage: 'Armazenamento',
        sLanguage: 'Idioma', sLanguageSubtitle: 'Escolha o idioma da interface',
        save: 'Salvar', cancel: 'Cancelar', loading: 'Carregando...',
        logoutConfirmTitle: 'Sair da Conta', logoutConfirmMsg: 'Tem certeza que deseja encerrar sua sessão?',
        logoutConfirmBtn: 'Sair', logoutCancelBtn: 'Manter conectado',
        cropTitle: 'Ajustar foto de perfil', cropHint: 'Arraste para reposicionar · Scroll para zoom',
        cropUploadClick: 'Clique para selecionar uma imagem', cropUploadFormats: 'JPG, PNG, WebP · máx. 5MB',
        cropSwap: 'Trocar foto', cropApply: 'Aplicar', cropApplying: 'Enviando...',
    },
    'en': {
        myday: 'My Day', important: 'Important', planned: 'Planned',
        dashboard: 'Overview', boards: 'BOARDS', general: 'GENERAL',
        resources: 'WIDGETS', others: 'OTHERS', focusMode: 'Focus Mode',
        settings: 'Settings', help: 'Help Center', logout: 'Sign Out',
        search: 'Search tasks...', notifications: 'Notifications', newBoard: 'New Board',
        stAccount: 'Account', stSecurity: 'Security', stAppearance: 'Appearance', stApp: 'Application', stLanguage: 'Language',
        acTitle: 'Account', acSubtitle: 'Manage your personal information',
        acPersonalInfo: 'Personal Information', acName: 'Name', acNamePh: 'Your name',
        acUsername: 'Username', acEmail: 'E-mail',
        acEmailHint: 'Changing your email requires confirmation from the provider.',
        acBio: 'Bio', acBioPh: 'Tell us a bit about you...',
        acSave: 'Save Changes', acSaved: 'Saved! ✓',
        acDangerZone: 'Danger Zone',
        acClearData: 'Clear all data', acClearDataDesc: 'Removes all boards, tasks and settings', acClearBtn: 'Clear',
        acLogout: 'Sign out', acLogoutDesc: 'End the current session', acLogoutBtn: 'Sign out',
        avChangePhoto: 'Change photo', avSetPhoto: 'Set photo', avSetEmoji: 'Set emoji', avRemovePhoto: 'Remove photo',
        avSetEmojiDisabled: 'Set emoji (remove photo first)',
        secTitle: 'Security', secSubtitle: 'Two-factor authentication and linked accounts',
        secEmailLogin: 'Email and login', secEmailVerified: 'Email verified', secPasswordLinked: 'Password linked',
        secNoPasswordHint: 'Set a password below to also sign in with email and password.',
        secPassword: 'Password', secSetPasswordDesc: 'Set a password to enable email/password login.',
        secPasswordSuccess: 'Password set. You can now sign in with email and password.',
        secPasswordChanged: 'Password changed successfully.',
        secCurrentPassword: 'Current password', secCurrentPasswordPh: 'Your current password',
        secNewPassword: 'New password', secNewPasswordPh: 'Minimum 6 characters',
        secConfirmPassword: 'Confirm password', secConfirmPasswordNew: 'Confirm new password',
        secPasswordPh2: 'Repeat password', secPasswordPh3: 'Repeat new password',
        secSetPassword: 'Set password', secChangePassword: 'Change password',
        sec2fa: 'Two-factor authentication (2FA)', sec2faActive: '2FA active', secDisable2fa: 'Disable 2FA',
        sec2faScanDesc: 'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.):',
        sec2faCodePh: '6-digit code', sec2faConfirm: 'Confirm and enable 2FA',
        sec2faDesc: 'Protect your account with a code generated on your phone.',
        sec2faActivating: 'Opening...', sec2faEnable: 'Enable 2FA',
        secLinkedAccounts: 'Linked accounts', secLinkedDesc: 'Link Google, GitHub or Microsoft for one-click sign in.',
        secLoading: 'Loading...', secLinked: 'Linked', secNotLinked: 'Not linked',
        secUnlink: 'Unlink', secLink: 'Link',
        appTitle: 'Appearance', appSubtitle: 'Customize your DailyWays look',
        sTheme: 'Theme', sThemeLight: 'Light', sThemeDark: 'Dark',
        sAccentColor: 'Accent Color', sAccentDesc: 'Choose the main color of the interface',
        sZoom: 'Interface Size',
        sFont: 'Font', sFontDesc: 'Choose the interface font',
        sAnimStyle: 'Animation Style', sAnimDesc: 'Controls the level of UI animations',
        sAnimSmooth: 'Smooth', sAnimSmoothDesc: 'Fluid and elegant animations',
        sAnimFlat: 'Flat', sAnimFlatDesc: 'No animations, direct navigation',
        appTabTitle: 'Application', appTabSubtitle: 'General app settings',
        sNotifications: 'Notifications', sNotifPush: 'Push Notifications', sNotifPushDesc: 'Get alerts about tasks due',
        sSounds: 'Sounds', sSoundsDesc: 'Play sounds when completing tasks',
        sAutoSave: 'Auto-save', sAutoSaveDesc: 'Save changes in real time',
        sData: 'Data', sVersion: 'Version', sStorage: 'Storage',
        sLanguage: 'Language', sLanguageSubtitle: 'Choose your interface language',
        save: 'Save', cancel: 'Cancel', loading: 'Loading...',
        logoutConfirmTitle: 'Sign Out', logoutConfirmMsg: 'Are you sure you want to end your session?',
        logoutConfirmBtn: 'Sign Out', logoutCancelBtn: 'Stay logged in',
        cropTitle: 'Adjust profile photo', cropHint: 'Drag to reposition · Scroll to zoom',
        cropUploadClick: 'Click to select an image', cropUploadFormats: 'JPG, PNG, WebP · max 5MB',
        cropSwap: 'Change image', cropApply: 'Apply', cropApplying: 'Uploading...',
    },
    'es': {
        myday: 'Mi Día', important: 'Importante', planned: 'Planificado',
        dashboard: 'Vista General', boards: 'TABLEROS', general: 'GENERAL',
        resources: 'WIDGETS', others: 'OTROS', focusMode: 'Modo Enfoque',
        settings: 'Configuración', help: 'Centro de Ayuda', logout: 'Salir',
        search: 'Buscar tareas...', notifications: 'Notificaciones', newBoard: 'Nuevo Tablero',
        stAccount: 'Cuenta', stSecurity: 'Seguridad', stAppearance: 'Apariencia', stApp: 'Aplicación', stLanguage: 'Idioma',
        acTitle: 'Cuenta', acSubtitle: 'Gestiona tu información personal',
        acPersonalInfo: 'Información Personal', acName: 'Nombre', acNamePh: 'Tu nombre',
        acUsername: 'Nombre de usuario', acEmail: 'Correo electrónico',
        acEmailHint: 'Cambiar el email requiere confirmación del proveedor.',
        acBio: 'Bio', acBioPh: 'Cuéntanos un poco sobre ti...',
        acSave: 'Guardar Cambios', acSaved: '¡Guardado! ✓',
        acDangerZone: 'Zona de Peligro',
        acClearData: 'Borrar todos los datos', acClearDataDesc: 'Elimina todos los tableros, tareas y configuraciones', acClearBtn: 'Borrar',
        acLogout: 'Cerrar sesión', acLogoutDesc: 'Terminar la sesión actual', acLogoutBtn: 'Salir',
        avChangePhoto: 'Cambiar foto', avSetPhoto: 'Definir foto', avSetEmoji: 'Definir emoji', avRemovePhoto: 'Eliminar foto',
        avSetEmojiDisabled: 'Definir emoji (elimina la foto primero)',
        secTitle: 'Seguridad', secSubtitle: 'Autenticación en dos pasos y cuentas vinculadas',
        secEmailLogin: 'Correo y acceso', secEmailVerified: 'Correo verificado', secPasswordLinked: 'Contraseña vinculada',
        secNoPasswordHint: 'Define una contraseña para acceder también con correo y contraseña.',
        secPassword: 'Contraseña', secSetPasswordDesc: 'Define una contraseña para habilitar el acceso por correo.',
        secPasswordSuccess: 'Contraseña definida. Puedes acceder con correo y contraseña.',
        secPasswordChanged: 'Contraseña cambiada con éxito.',
        secCurrentPassword: 'Contraseña actual', secCurrentPasswordPh: 'Tu contraseña actual',
        secNewPassword: 'Nueva contraseña', secNewPasswordPh: 'Mínimo 6 caracteres',
        secConfirmPassword: 'Confirmar contraseña', secConfirmPasswordNew: 'Confirmar nueva contraseña',
        secPasswordPh2: 'Repite la contraseña', secPasswordPh3: 'Repite la nueva contraseña',
        secSetPassword: 'Definir contraseña', secChangePassword: 'Cambiar contraseña',
        sec2fa: 'Verificación en dos pasos (2FA)', sec2faActive: '2FA activo', secDisable2fa: 'Desactivar 2FA',
        sec2faScanDesc: 'Escanea el QR con tu app autenticadora (Google Authenticator, Authy, etc.):',
        sec2faCodePh: 'Código de 6 dígitos', sec2faConfirm: 'Confirmar y activar 2FA',
        sec2faDesc: 'Protege tu cuenta con un código generado en tu teléfono.',
        sec2faActivating: 'Abriendo...', sec2faEnable: 'Activar 2FA',
        secLinkedAccounts: 'Cuentas vinculadas', secLinkedDesc: 'Vincula Google, GitHub o Microsoft para acceder con un clic.',
        secLoading: 'Cargando...', secLinked: 'Vinculado', secNotLinked: 'No vinculado',
        secUnlink: 'Desvincular', secLink: 'Vincular',
        appTitle: 'Apariencia', appSubtitle: 'Personaliza el aspecto de tu DailyWays',
        sTheme: 'Tema', sThemeLight: 'Claro', sThemeDark: 'Oscuro',
        sAccentColor: 'Color de Acento', sAccentDesc: 'Elige el color principal de la interfaz',
        sZoom: 'Tamaño de la Interfaz',
        sFont: 'Fuente', sFontDesc: 'Elige la fuente de la interfaz',
        sAnimStyle: 'Estilo de Animación', sAnimDesc: 'Controla el nivel de animaciones',
        sAnimSmooth: 'Suave', sAnimSmoothDesc: 'Animaciones fluidas y elegantes',
        sAnimFlat: 'Plano', sAnimFlatDesc: 'Sin animaciones, navegación directa',
        appTabTitle: 'Aplicación', appTabSubtitle: 'Configuraciones generales de la app',
        sNotifications: 'Notificaciones', sNotifPush: 'Notificaciones Push', sNotifPushDesc: 'Recibe alertas sobre tareas próximas a vencer',
        sSounds: 'Sonidos', sSoundsDesc: 'Reproducir sonidos al completar tareas',
        sAutoSave: 'Guardar automáticamente', sAutoSaveDesc: 'Guardar cambios en tiempo real',
        sData: 'Datos', sVersion: 'Versión', sStorage: 'Almacenamiento',
        sLanguage: 'Idioma', sLanguageSubtitle: 'Elige el idioma de la interfaz',
        save: 'Guardar', cancel: 'Cancelar', loading: 'Cargando...',
        logoutConfirmTitle: 'Cerrar Sesión', logoutConfirmMsg: '¿Estás seguro de que deseas cerrar sesión?',
        logoutConfirmBtn: 'Salir', logoutCancelBtn: 'Permanecer conectado',
        cropTitle: 'Ajustar foto de perfil', cropHint: 'Arrastra para reposicionar · Scroll para zoom',
        cropUploadClick: 'Haz clic para seleccionar una imagen', cropUploadFormats: 'JPG, PNG, WebP · máx. 5MB',
        cropSwap: 'Cambiar imagen', cropApply: 'Aplicar', cropApplying: 'Subiendo...',
    },
    'fr': {
        myday: 'Ma Journée', important: 'Important', planned: 'Planifié',
        dashboard: 'Vue générale', boards: 'TABLEAUX', general: 'GÉNÉRAL',
        resources: 'WIDGETS', others: 'AUTRES', focusMode: 'Mode Focus',
        settings: 'Paramètres', help: "Centre d'aide", logout: 'Se déconnecter',
        search: 'Rechercher des tâches...', notifications: 'Notifications', newBoard: 'Nouveau Tableau',
        stAccount: 'Compte', stSecurity: 'Sécurité', stAppearance: 'Apparence', stApp: 'Application', stLanguage: 'Langue',
        acTitle: 'Compte', acSubtitle: 'Gérez vos informations personnelles',
        acPersonalInfo: 'Informations Personnelles', acName: 'Nom', acNamePh: 'Votre nom',
        acUsername: "Nom d'utilisateur", acEmail: 'E-mail',
        acEmailHint: "La modification de l'e-mail nécessite une confirmation auprès du fournisseur.",
        acBio: 'Bio', acBioPh: 'Parlez-nous un peu de vous...',
        acSave: 'Enregistrer les modifications', acSaved: 'Enregistré ! ✓',
        acDangerZone: 'Zone Dangereuse',
        acClearData: 'Effacer toutes les données', acClearDataDesc: 'Supprime tous les tableaux, tâches et paramètres', acClearBtn: 'Effacer',
        acLogout: 'Se déconnecter', acLogoutDesc: 'Terminer la session actuelle', acLogoutBtn: 'Se déconnecter',
        avChangePhoto: 'Changer la photo', avSetPhoto: 'Définir une photo', avSetEmoji: 'Définir un emoji', avRemovePhoto: 'Supprimer la photo',
        avSetEmojiDisabled: 'Définir un emoji (supprimez la photo en premier)',
        secTitle: 'Sécurité', secSubtitle: 'Authentification à deux facteurs et comptes liés',
        secEmailLogin: 'E-mail et connexion', secEmailVerified: 'E-mail vérifié', secPasswordLinked: 'Mot de passe lié',
        secNoPasswordHint: 'Définissez un mot de passe pour vous connecter aussi par e-mail.',
        secPassword: 'Mot de passe', secSetPasswordDesc: 'Définissez un mot de passe pour activer la connexion par e-mail.',
        secPasswordSuccess: 'Mot de passe défini. Vous pouvez maintenant vous connecter par e-mail.',
        secPasswordChanged: 'Mot de passe modifié avec succès.',
        secCurrentPassword: 'Mot de passe actuel', secCurrentPasswordPh: 'Votre mot de passe actuel',
        secNewPassword: 'Nouveau mot de passe', secNewPasswordPh: '6 caractères minimum',
        secConfirmPassword: 'Confirmer le mot de passe', secConfirmPasswordNew: 'Confirmer le nouveau mot de passe',
        secPasswordPh2: 'Répétez le mot de passe', secPasswordPh3: 'Répétez le nouveau mot de passe',
        secSetPassword: 'Définir le mot de passe', secChangePassword: 'Changer le mot de passe',
        sec2fa: 'Vérification en deux étapes (2FA)', sec2faActive: '2FA actif', secDisable2fa: 'Désactiver 2FA',
        sec2faScanDesc: "Scannez le QR code avec votre application d'authentification (Google Authenticator, Authy, etc.) :",
        sec2faCodePh: 'Code à 6 chiffres', sec2faConfirm: 'Confirmer et activer 2FA',
        sec2faDesc: 'Protégez votre compte avec un code généré sur votre téléphone.',
        sec2faActivating: 'Ouverture...', sec2faEnable: 'Activer 2FA',
        secLinkedAccounts: 'Comptes liés', secLinkedDesc: 'Liez Google, GitHub ou Microsoft pour vous connecter en un clic.',
        secLoading: 'Chargement...', secLinked: 'Lié', secNotLinked: 'Non lié',
        secUnlink: 'Délier', secLink: 'Lier',
        appTitle: 'Apparence', appSubtitle: 'Personnalisez votre DailyWays',
        sTheme: 'Thème', sThemeLight: 'Clair', sThemeDark: 'Sombre',
        sAccentColor: "Couleur d'accentuation", sAccentDesc: "Choisissez la couleur principale de l'interface",
        sZoom: "Taille de l'interface",
        sFont: 'Police', sFontDesc: "Choisissez la police de l'interface",
        sAnimStyle: "Style d'animation", sAnimDesc: "Contrôle le niveau d'animations de l'interface",
        sAnimSmooth: 'Fluide', sAnimSmoothDesc: 'Animations fluides et élégantes',
        sAnimFlat: 'Plat', sAnimFlatDesc: 'Sans animations, navigation directe',
        appTabTitle: 'Application', appTabSubtitle: "Paramètres généraux de l'application",
        sNotifications: 'Notifications', sNotifPush: 'Notifications Push', sNotifPushDesc: 'Recevez des alertes sur les tâches à venir',
        sSounds: 'Sons', sSoundsDesc: 'Jouer des sons lors de la complétion des tâches',
        sAutoSave: 'Enregistrement automatique', sAutoSaveDesc: 'Sauvegarder les modifications en temps réel',
        sData: 'Données', sVersion: 'Version', sStorage: 'Stockage',
        sLanguage: 'Langue', sLanguageSubtitle: "Choisissez la langue de l'interface",
        save: 'Enregistrer', cancel: 'Annuler', loading: 'Chargement...',
        logoutConfirmTitle: 'Se Déconnecter', logoutConfirmMsg: 'Voulez-vous vraiment mettre fin à votre session ?',
        logoutConfirmBtn: 'Se déconnecter', logoutCancelBtn: 'Rester connecté',
        cropTitle: 'Ajuster la photo de profil', cropHint: 'Faites glisser pour repositionner · Scroll pour zoomer',
        cropUploadClick: 'Cliquez pour sélectionner une image', cropUploadFormats: 'JPG, PNG, WebP · max 5 Mo',
        cropSwap: "Changer d'image", cropApply: 'Appliquer', cropApplying: 'Envoi...',
    },
    'de': {
        myday: 'Mein Tag', important: 'Wichtig', planned: 'Geplant',
        dashboard: 'Übersicht', boards: 'BOARDS', general: 'ALLGEMEIN',
        resources: 'WIDGETS', others: 'SONSTIGES', focusMode: 'Fokusmodus',
        settings: 'Einstellungen', help: 'Hilfe', logout: 'Abmelden',
        search: 'Aufgaben suchen...', notifications: 'Benachrichtigungen', newBoard: 'Neues Board',
        stAccount: 'Konto', stSecurity: 'Sicherheit', stAppearance: 'Erscheinungsbild', stApp: 'Anwendung', stLanguage: 'Sprache',
        acTitle: 'Konto', acSubtitle: 'Verwalten Sie Ihre persönlichen Informationen',
        acPersonalInfo: 'Persönliche Informationen', acName: 'Name', acNamePh: 'Ihr Name',
        acUsername: 'Benutzername', acEmail: 'E-Mail',
        acEmailHint: 'Das Ändern der E-Mail erfordert eine Bestätigung beim Anbieter.',
        acBio: 'Bio', acBioPh: 'Erzählen Sie uns etwas über sich...',
        acSave: 'Änderungen speichern', acSaved: 'Gespeichert! ✓',
        acDangerZone: 'Gefahrenzone',
        acClearData: 'Alle Daten löschen', acClearDataDesc: 'Entfernt alle Boards, Aufgaben und Einstellungen', acClearBtn: 'Löschen',
        acLogout: 'Abmelden', acLogoutDesc: 'Aktuelle Sitzung beenden', acLogoutBtn: 'Abmelden',
        avChangePhoto: 'Foto ändern', avSetPhoto: 'Foto festlegen', avSetEmoji: 'Emoji festlegen', avRemovePhoto: 'Foto entfernen',
        avSetEmojiDisabled: 'Emoji festlegen (Foto zuerst entfernen)',
        secTitle: 'Sicherheit', secSubtitle: 'Zwei-Faktor-Authentifizierung und verknüpfte Konten',
        secEmailLogin: 'E-Mail und Anmeldung', secEmailVerified: 'E-Mail verifiziert', secPasswordLinked: 'Passwort verknüpft',
        secNoPasswordHint: 'Setzen Sie ein Passwort, um sich auch mit E-Mail und Passwort anzumelden.',
        secPassword: 'Passwort', secSetPasswordDesc: 'Setzen Sie ein Passwort für die E-Mail-Anmeldung.',
        secPasswordSuccess: 'Passwort gesetzt. Sie können sich jetzt mit E-Mail und Passwort anmelden.',
        secPasswordChanged: 'Passwort erfolgreich geändert.',
        secCurrentPassword: 'Aktuelles Passwort', secCurrentPasswordPh: 'Ihr aktuelles Passwort',
        secNewPassword: 'Neues Passwort', secNewPasswordPh: 'Mindestens 6 Zeichen',
        secConfirmPassword: 'Passwort bestätigen', secConfirmPasswordNew: 'Neues Passwort bestätigen',
        secPasswordPh2: 'Passwort wiederholen', secPasswordPh3: 'Neues Passwort wiederholen',
        secSetPassword: 'Passwort setzen', secChangePassword: 'Passwort ändern',
        sec2fa: 'Zwei-Faktor-Authentifizierung (2FA)', sec2faActive: '2FA aktiv', secDisable2fa: '2FA deaktivieren',
        sec2faScanDesc: 'Scannen Sie den QR-Code mit Ihrer Authenticator-App (Google Authenticator, Authy, etc.):',
        sec2faCodePh: '6-stelliger Code', sec2faConfirm: '2FA bestätigen und aktivieren',
        sec2faDesc: 'Schützen Sie Ihr Konto mit einem auf Ihrem Telefon generierten Code.',
        sec2faActivating: 'Wird geöffnet...', sec2faEnable: '2FA aktivieren',
        secLinkedAccounts: 'Verknüpfte Konten', secLinkedDesc: 'Verknüpfen Sie Google, GitHub oder Microsoft für die Einzel-Klick-Anmeldung.',
        secLoading: 'Laden...', secLinked: 'Verknüpft', secNotLinked: 'Nicht verknüpft',
        secUnlink: 'Trennen', secLink: 'Verknüpfen',
        appTitle: 'Erscheinungsbild', appSubtitle: 'Passen Sie das Erscheinungsbild an',
        sTheme: 'Design', sThemeLight: 'Hell', sThemeDark: 'Dunkel',
        sAccentColor: 'Akzentfarbe', sAccentDesc: 'Wählen Sie die Hauptfarbe der Benutzeroberfläche',
        sZoom: 'Größe der Benutzeroberfläche',
        sFont: 'Schriftart', sFontDesc: 'Wählen Sie die Schriftart der Benutzeroberfläche',
        sAnimStyle: 'Animationsstil', sAnimDesc: 'Steuert das Animationsniveau der Benutzeroberfläche',
        sAnimSmooth: 'Weich', sAnimSmoothDesc: 'Flüssige und elegante Animationen',
        sAnimFlat: 'Flach', sAnimFlatDesc: 'Keine Animationen, direkte Navigation',
        appTabTitle: 'Anwendung', appTabSubtitle: 'Allgemeine App-Einstellungen',
        sNotifications: 'Benachrichtigungen', sNotifPush: 'Push-Benachrichtigungen', sNotifPushDesc: 'Erhalten Sie Warnungen über fällige Aufgaben',
        sSounds: 'Töne', sSoundsDesc: 'Töne beim Abschließen von Aufgaben abspielen',
        sAutoSave: 'Automatisch speichern', sAutoSaveDesc: 'Änderungen in Echtzeit speichern',
        sData: 'Daten', sVersion: 'Version', sStorage: 'Speicher',
        sLanguage: 'Sprache', sLanguageSubtitle: 'Wählen Sie die Sprache der Benutzeroberfläche',
        save: 'Speichern', cancel: 'Abbrechen', loading: 'Laden...',
        logoutConfirmTitle: 'Abmelden', logoutConfirmMsg: 'Sind Sie sicher, dass Sie sich abmelden möchten?',
        logoutConfirmBtn: 'Abmelden', logoutCancelBtn: 'Angemeldet bleiben',
        cropTitle: 'Profilfoto anpassen', cropHint: 'Ziehen zum Repositionieren · Scrollen zum Zoomen',
        cropUploadClick: 'Klicken Sie, um ein Bild auszuwählen', cropUploadFormats: 'JPG, PNG, WebP · max. 5 MB',
        cropSwap: 'Bild wechseln', cropApply: 'Anwenden', cropApplying: 'Wird hochgeladen...',
    },
    'ja': {
        myday: '今日', important: '重要', planned: '計画中',
        dashboard: '概要', boards: 'ボード', general: '一般',
        resources: 'ウィジェット', others: 'その他', focusMode: 'フォーカスモード',
        settings: '設定', help: 'ヘルプ', logout: 'ログアウト',
        search: 'タスクを検索...', notifications: '通知', newBoard: '新規ボード',
        stAccount: 'アカウント', stSecurity: 'セキュリティ', stAppearance: '外観', stApp: 'アプリ', stLanguage: '言語',
        acTitle: 'アカウント', acSubtitle: '個人情報の管理',
        acPersonalInfo: '個人情報', acName: '名前', acNamePh: 'あなたの名前',
        acUsername: 'ユーザー名', acEmail: 'メール',
        acEmailHint: 'メールの変更はプロバイダーでの確認が必要です。',
        acBio: '自己紹介', acBioPh: '自分について少し教えてください...',
        acSave: '変更を保存', acSaved: '保存完了！ ✓',
        acDangerZone: '危険ゾーン',
        acClearData: 'すべてのデータを削除', acClearDataDesc: 'すべてのボード、タスク、設定を削除します', acClearBtn: '削除',
        acLogout: 'ログアウト', acLogoutDesc: '現在のセッションを終了', acLogoutBtn: 'ログアウト',
        avChangePhoto: '写真を変更', avSetPhoto: '写真を設定', avSetEmoji: '絵文字を設定', avRemovePhoto: '写真を削除',
        avSetEmojiDisabled: '絵文字を設定（先に写真を削除してください）',
        secTitle: 'セキュリティ', secSubtitle: '二段階認証とリンクされたアカウント',
        secEmailLogin: 'メールとログイン', secEmailVerified: 'メール確認済み', secPasswordLinked: 'パスワードがリンクされています',
        secNoPasswordHint: 'メールとパスワードでもログインできるように、パスワードを設定してください。',
        secPassword: 'パスワード', secSetPasswordDesc: 'メールログインを有効にするためにパスワードを設定してください。',
        secPasswordSuccess: 'パスワードが設定されました。メールとパスワードでログインできます。',
        secPasswordChanged: 'パスワードが正常に変更されました。',
        secCurrentPassword: '現在のパスワード', secCurrentPasswordPh: '現在のパスワード',
        secNewPassword: '新しいパスワード', secNewPasswordPh: '最佖6文字',
        secConfirmPassword: 'パスワードの確認', secConfirmPasswordNew: '新しいパスワードの確認',
        secPasswordPh2: 'パスワードを繰り返す', secPasswordPh3: '新しいパスワードを繰り返す',
        secSetPassword: 'パスワードを設定', secChangePassword: 'パスワードを変更',
        sec2fa: '二段階認証 (2FA)', sec2faActive: '2FA有効', secDisable2fa: '2FAを無効化',
        sec2faScanDesc: '認証アプリでQRコードをスキャンしてください（Google Authenticator、Authyなど）：',
        sec2faCodePh: '6桁のコード', sec2faConfirm: '2FAを確認して有効化',
        sec2faDesc: '電話で生成されたコードでアカウントを保護してください。',
        sec2faActivating: '開いています...', sec2faEnable: '2FAを有効化',
        secLinkedAccounts: 'リンクされたアカウント', secLinkedDesc: 'Google、GitHub、またはMicrosoftをリンクしてワンクリックでサインインできます。',
        secLoading: '読み込み中...', secLinked: 'リンク済み', secNotLinked: '未リンク',
        secUnlink: 'リンク解除', secLink: 'リンク',
        appTitle: '外観', appSubtitle: 'DailyWaysの外観をカスタマイズ',
        sTheme: 'テーマ', sThemeLight: 'ライト', sThemeDark: 'ダーク',
        sAccentColor: 'アクセントカラー', sAccentDesc: 'インターフェースのメインカラーを選択',
        sZoom: 'インターフェースサイズ',
        sFont: 'フォント', sFontDesc: 'インターフェースのフォントを選択',
        sAnimStyle: 'アニメーションスタイル', sAnimDesc: 'UIアニメーションのレベルを制御',
        sAnimSmooth: 'スムーズ', sAnimSmoothDesc: '流れるようなエレガントなアニメーション',
        sAnimFlat: 'フラット', sAnimFlatDesc: 'アニメーションなし、ダイレクトナビゲーション',
        appTabTitle: 'アプリケーション', appTabSubtitle: '一般的なアプリ設定',
        sNotifications: '通知', sNotifPush: 'プッシュ通知', sNotifPushDesc: 'タスクの期限に関するアラートを受け取る',
        sSounds: 'サウンド', sSoundsDesc: 'タスク完了時にサウンドを再生',
        sAutoSave: '自動保存', sAutoSaveDesc: 'リアルタイムで変更を保存',
        sData: 'データ', sVersion: 'バージョン', sStorage: 'ストレージ',
        sLanguage: '言語', sLanguageSubtitle: 'インターフェースの言語を選択',
        save: '保存', cancel: 'キャンセル', loading: '読み込み中...',
        logoutConfirmTitle: 'ログアウト', logoutConfirmMsg: 'セッションを終了しますか？',
        logoutConfirmBtn: 'ログアウト', logoutCancelBtn: 'ログインを維持',
        cropTitle: 'プロフィール写真を調整', cropHint: 'ドラッグして位置を変更 · スクロールでズーム',
        cropUploadClick: 'クリックして画像を選択', cropUploadFormats: 'JPG、PNG、WebP · 最大10MB',
        cropSwap: '画像を変更', cropApply: '適用', cropApplying: 'アップロード中...',
    },
};

export const useI18n = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useI18n must be used within ThemeProvider');
    return TRANSLATIONS[ctx.language] || TRANSLATIONS['pt-br'];
};

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(() =>
        storageService.load('dailyways_theme') || 'light'
    );

    const [accentId, setAccentId] = useState(() =>
        storageService.load('dailyways_accent') || 'purple'
    );

    const [fontId, setFontId] = useState(() =>
        storageService.load('dailyways_font') || 'poppins'
    );

    const [language, setLanguageState] = useState(() =>
        storageService.load('dailyways_language') || 'pt-br'
    );

    const [animStyle, setAnimStyleState] = useState(() =>
        storageService.load('dailyways_anim') || 'default'
    );

    // userId is stored so setters can save to DB
    const userIdRef = useRef(null);
    const dbSaveTimer = useRef(null);

    const saveToDb = useCallback((updates) => {
        if (!userIdRef.current) return;
        clearTimeout(dbSaveTimer.current);
        dbSaveTimer.current = setTimeout(() => {
            supabase.from('profiles').update({
                ...updates,
                updated_at: new Date().toISOString(),
            }).eq('id', userIdRef.current).then(({ error }) => {
                if (error) console.warn('[Theme] DB save error:', error.message);
            });
        }, 600);
    }, []);

    // Called by App.jsx after user logs in — loads profile prefs silently
    const initPreferences = useCallback((uid, profile) => {
        userIdRef.current = uid;
        if (!uid || !profile) return;
        const t = profile.theme || storageService.load('dailyways_theme') || 'dark';
        const a = profile.accent || storageService.load('dailyways_accent') || 'purple';
        const f = profile.font_id || storageService.load('dailyways_font') || 'poppins';
        const l = profile.language || storageService.load('dailyways_language') || 'pt-br';
        const an = profile.anim_style || storageService.load('dailyways_anim') || 'default';
        // Apply silently (no DB save triggered)
        setThemeState(t); storageService.save('dailyways_theme', t);
        setAccentId(a); storageService.save('dailyways_accent', a);
        setFontId(f); storageService.save('dailyways_font', f);
        setLanguageState(l); storageService.save('dailyways_language', l);
        setAnimStyleState(an); storageService.save('dailyways_anim', an);
    }, []);

    const accent = ACCENT_PRESETS.find(a => a.id === accentId) || ACCENT_PRESETS[0];
    const font = FONT_PRESETS.find(f => f.id === fontId) || FONT_PRESETS[0];

    // Apply theme + accent to DOM
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        storageService.save('dailyways_theme', theme);
    }, [theme]);


    useEffect(() => {
        const root = document.documentElement;
        const grad = accent.gradient || `linear-gradient(135deg, ${accent.color} 0%, ${accent.secondary} 100%)`;
        root.style.setProperty('--accent-primary', accent.color);
        root.style.setProperty('--accent-secondary', accent.secondary);
        root.style.setProperty('--accent-gradient', grad);
        root.style.setProperty('--accent-gradient-hover', `linear-gradient(135deg, ${accent.color}dd 0%, ${accent.color} 100%)`);
        root.style.setProperty('--accent-glow', `0 4px 16px ${accent.color}40`);

        // Light-specific accent derivatives
        if (document.documentElement.getAttribute('data-theme') === 'light') {
            root.style.setProperty('--accent-light', `${accent.color}18`);
            root.style.setProperty('--bg-hover', `${accent.color}0d`);
            root.style.setProperty('--bg-active', `${accent.color}1a`);
            root.style.setProperty('--glass-border', `${accent.color}1a`);
        } else {
            root.style.setProperty('--accent-light', `${accent.color}26`);
            root.style.setProperty('--bg-hover', `${accent.color}14`);
            root.style.setProperty('--bg-active', `${accent.color}26`);
            root.style.setProperty('--glass-border', `${accent.color}1f`);
        }

        storageService.save('dailyways_accent', accentId);
    }, [accent, accentId, theme]);

    // Apply font to DOM
    useEffect(() => {
        document.documentElement.style.setProperty('--font-family', font.family);
        storageService.save('dailyways_font', fontId);
    }, [font, fontId]);

    // Persist language
    const setLanguage = (id) => {
        setLanguageState(id);
        storageService.save('dailyways_language', id);
        saveToDb({ language: id });
    };

    // Apply animation style to DOM
    useEffect(() => {
        document.documentElement.setAttribute('data-anim', animStyle);
        storageService.save('dailyways_anim', animStyle);
    }, [animStyle]);

    const setAnimStyle = (id) => {
        setAnimStyleState(id);
        saveToDb({ anim_style: id });
    };

    const setTheme = (val) => {
        setThemeState(val);
        saveToDb({ theme: val });
    };

    const toggleTheme = () => {
        setThemeState(prev => {
            const next = prev === 'light' ? 'dark' : 'light';
            saveToDb({ theme: next });
            return next;
        });
    };

    const setAccent = (id) => {
        setAccentId(id);
        saveToDb({ accent: id });
    };

    const setFont = (id) => {
        setFontId(id);
        saveToDb({ font_id: id });
    };

    const ctxValue = useMemo(() => ({
        theme, toggleTheme, setTheme, accentId, setAccent, accent, ACCENT_PRESETS, THEME_PRESETS,
        fontId, setFont, FONT_PRESETS, language, setLanguage,
        animStyle, setAnimStyle, initPreferences,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [theme, accentId, accent, fontId, language, animStyle, initPreferences]);

    return (
        <ThemeContext.Provider value={ctxValue}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};
