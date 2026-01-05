import reactHooks from 'eslint-plugin-react-hooks';

console.log('Keys:', Object.keys(reactHooks));
if (reactHooks.configs) {
    console.log('Configs:', Object.keys(reactHooks.configs));
    if (reactHooks.configs.flat) {
        console.log('Has Flat Config:', Object.keys(reactHooks.configs.flat));
    }
}
