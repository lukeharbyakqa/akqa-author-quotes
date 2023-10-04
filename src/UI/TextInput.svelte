<script>    
    export let name = "";
    export let placeholder = "";
</script>

<style>
    input {
        margin: 0 0 0 1rem;
        border: 0;
        flex-grow: 1;
    }
</style>

<input type="text" on:keypress bind:value={name} placeholder={placeholder} on:focus on:blur />