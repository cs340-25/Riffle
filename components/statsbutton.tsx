import { StyleSheet, View, Text, Image, Pressable } from 'react-native';

export default function StatsButton() {
    return (
        <View style={styles.container}>
            <Pressable
                onPress={() => console.log("Pressed button (will add scene change)")}
                style={({ pressed }) => {
                    return { opacity: pressed ? 0.5 : 1 }
                }}>
                <Image source={require("../assets/images/statsbutton.png")}
                    style={styles.image}
                />
            </Pressable>
        </View >
    )
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        alignItems: 'center',
        width: 150,
        height: 150
    },
    image: {
        width: 150,
        height: 150
    }
})